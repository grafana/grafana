import MVT from 'ol/format/MVT';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import { applyBackground, applyStyle } from 'ol-mapbox-style';
import { PMTilesVectorSource } from 'ol-pmtiles';

import { type GrafanaTheme2, type MapLayerHandler, type MapLayerRegistryItem } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

// The build is an ODbL Produced Work, so the OpenStreetMap credit must stay visible
const ATTRIBUTION = `<a href="https://protomaps.com">Protomaps</a> <a href="https://www.openstreetmap.org/copyright">©OpenStreetMap</a> contributors`;

/** Where a local Protomaps tile server listens by default; replaced by a real host before this leaves dev */
const DEV_SERVER_URL = 'http://localhost:8095/';

/** The source id the Protomaps style generator gives every layer */
const SOURCE_ID = 'protomaps';

/** Protomaps planet builds stop at zoom 15; OpenLayers overzooms the last level beyond that */
const MAX_TILE_ZOOM = 15;

/**
 * Protomaps names minor roads, paths and roads of kind `other` from zoom 15. In dense cities that is
 * thousands of line labels, each split into pieces that are placed and drawn every frame, which
 * drops panning to about 15 fps. The default basemap waits until zoom 16 and leaves paths unnamed.
 */
const MINOR_ROAD_LABELS = 'roads_labels_minor';
const MINOR_ROAD_LABEL_MIN_ZOOM = 16;
/**
 * Replaces the upstream filter instead of joining it with `all`: that filter is legacy syntax, and an
 * expression beside it makes the style spec read the whole filter as an expression.
 */
const MINOR_ROAD_LABEL_FILTER: GlValue = ['==', ['get', 'kind'], 'minor_road'];

/**
 * The light and dark flavors label shops, restaurants and street furniture from the zoom each
 * feature allows. The default basemap only names parks, plus stadiums and attractions prominent enough to appear
 * by zoom 13, and only from zoom 15.
 */
const POI_LABELS = 'pois';
const POI_LABEL_MIN_ZOOM = 15;
const POI_LABEL_KINDS = ['park', 'stadium', 'attraction'];
const PROMINENT_POI: GlValue = [
  'all',
  ['in', ['get', 'kind'], ['literal', POI_LABEL_KINDS]],
  ['any', ['==', ['get', 'kind'], 'park'], ['<=', ['coalesce', ['get', 'min_zoom'], 0], 13]],
];

/** The map sits under the panel's data, so like the default basemap it shows no house numbers, shields or one-way arrows */
const UNLABELLED_LAYERS = new Set(['address_label', 'roads_shields', 'roads_oneway']);

export enum ProtomapsFlavor {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
  White = 'white',
  Grayscale = 'grayscale',
  Black = 'black',
}

export enum TileDelivery {
  /** One archive file read with HTTP range requests, decoded in the browser by ol-pmtiles */
  PMTiles = 'pmtiles',
  /** Conventional `{z}/{x}/{y}.mvt` URLs, as an edge function in front of the archive would serve */
  ZXY = 'zxy',
}

export interface ProtomapsConfig {
  flavor?: ProtomapsFlavor;
  showLabels?: boolean;
  delivery?: TileDelivery;
  server?: string;
}

const defaultProtomapsConfig: ProtomapsConfig = {
  flavor: ProtomapsFlavor.Auto,
  showLabels: true,
  delivery: TileDelivery.PMTiles,
  server: DEV_SERVER_URL,
};

/** Style filters and expressions are plain JSON */
type GlValue = string | number | boolean | null | GlValue[] | { [key: string]: GlValue };

interface GlLayer {
  id: string;
  type: string;
  minzoom?: number;
  filter?: GlValue;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
}

interface GlStyle {
  layers: GlLayer[];
}

/** An undefined value removes the generator's own, as for a dash the default basemap draws solid */
type Paint = Record<string, GlValue | undefined>;

type RoadClass = 'highway' | 'major' | 'secondary' | 'minor' | 'service' | 'other';

/** Protomaps' `major_road` kind covers these as well as trunk and primary roads */
const SECONDARY_ROADS = ['secondary', 'tertiary', 'secondary_link', 'tertiary_link'];

/** Road colors at zoom 5, 12 and 15 */
type RoadColors = [far: string, outer: string, inner: string];

/**
 * The default basemap draws roads as a fill inside a wide casing that leaves mostly casing showing until zoom 14,
 * and further out draws them in a lighter casing color. ol-mapbox-style ignores `line-gap-width`, so
 * Protomaps' casings draw as a plain line under the fill, and both take the color the default basemap shows at
 * each zoom.
 */
function defaultBasemapRoads(
  fills: Record<RoadClass, RoadColors>,
  tunnels: Record<Exclude<RoadClass, 'service'> | 'casing', string>
) {
  // The default basemap colors secondary and tertiary roads apart from trunk and primary ones in some flavors
  const colorAt = (roadClass: RoadClass, i: number): GlValue => {
    const [color, secondary] = [fills[roadClass][i], fills.secondary[i]];
    return roadClass !== 'major' || color === secondary
      ? color
      : ['match', ['get', 'kind_detail'], SECONDARY_ROADS, secondary, color];
  };
  const ramp = (roadClass: RoadClass, zooms: number[]) =>
    zoomRamp(...zooms.map((zoom, i): [number, GlValue] => [zoom, colorAt(roadClass, i)]));
  const fill = (roadClass: RoadClass) => ramp(roadClass, [5, 12, 15]);
  const paint: Record<string, Paint> = {};
  for (const prefix of ['roads_', 'roads_bridges_']) {
    paint[`${prefix}highway`] = { 'line-color': fill('highway'), 'line-width': HIGHWAY_WIDTH };
    paint[`${prefix}major`] = { 'line-color': fill('major') };
    paint[`${prefix}link`] = { 'line-color': fill('major') };
    paint[`${prefix}minor`] = { 'line-color': fill('minor') };
    paint[`${prefix}other`] = { 'line-color': fill('other') };
  }
  paint.roads_minor_service = { 'line-color': fill('service') };
  // The default basemap draws tunnels in one flat color per class at every zoom
  for (const roadClass of ['highway', 'major', 'link', 'minor', 'other'] as const) {
    const fillClass = roadClass === 'link' ? 'major' : roadClass;
    const color =
      fillClass === 'major' && tunnels.major !== tunnels.secondary
        ? ['match', ['get', 'kind_detail'], SECONDARY_ROADS, tunnels.secondary, tunnels.major]
        : tunnels[fillClass];
    paint[`roads_tunnels_${roadClass}`] = { 'line-color': color };
    paint[`roads_tunnels_${roadClass}_casing`] = { 'line-color': tunnels.casing };
  }
  for (const [id, roadClass] of [
    ['roads_minor_service_casing', 'service'],
    ['roads_minor_casing', 'minor'],
    ['roads_link_casing', 'major'],
    ['roads_major_casing_early', 'major'],
    ['roads_major_casing_late', 'major'],
    ['roads_highway_casing_early', 'highway'],
    ['roads_highway_casing_late', 'highway'],
    ['roads_bridges_other_casing', 'other'],
    ['roads_bridges_link_casing', 'major'],
    ['roads_bridges_minor_casing', 'minor'],
    ['roads_bridges_major_casing', 'major'],
    ['roads_bridges_highway_casing', 'highway'],
  ] as const) {
    paint[id] = { 'line-color': ramp(roadClass, [5, 12]) };
  }
  return paint;
}

/**
 * The default basemap's motorways are under a pixel wide until zoom 8, where Protomaps' are already over one. From
 * zoom 10 the width follows Protomaps' own ramp.
 */
const HIGHWAY_WIDTH = roadWidthRamp([3, 0], [6, 0.5], [7, 0.7], [8, 0.8], [10, 1.3], [12, 1.6], [15, 5], [18, 15]);

/** The default basemap fades a building's roof in over its footprint between zoom 13 and 16 */
function defaultBasemapBuildings(footprint: string, roof: string): Paint {
  return { 'fill-color': zoomRamp([13, footprint], [16, roof]), 'fill-opacity': 1 };
}

/**
 * White and Black stand in for the light and dark default basemaps that panels show, so they take
 * their colors, line widths and dashes. Most of the difference is the default basemap's slight blue
 * tint on water and labels where Protomaps is pure gray. Only paint changes here: which features
 * show, and from which zoom, stays with the label rules above.
 */
const DEFAULT_BASEMAP_PAINT: Partial<Record<ProtomapsFlavor, Record<string, Paint>>> = {
  [ProtomapsFlavor.White]: {
    background: { 'background-color': '#fafaf8' },
    earth: { 'fill-color': '#fafaf8' },
    water: { 'fill-color': '#d4dadc' },
    water_stream: { 'line-color': '#d1dbdf' },
    water_river: { 'line-color': '#d1dbdf' },
    buildings: defaultBasemapBuildings('#dfdfdf', '#ededed'),
    ...defaultBasemapRoads(
      {
        highway: ['#e6e6e6', '#dddddd', '#ffffff'],
        major: ['#e6e6e6', '#dddddd', '#ffffff'],
        secondary: ['#e6e6e6', '#dddddd', '#ffffff'],
        minor: ['#dddddd', '#dddddd', '#fdfdfd'],
        service: ['#dddddd', '#dddddd', '#fdfdfd'],
        other: ['#dddddd', '#dddddd', '#fdfdfd'],
      },
      {
        casing: '#dddddd',
        highway: '#eeeeee',
        major: '#eeeeee',
        secondary: '#eeeeee',
        minor: '#eeeeee',
        other: '#eeeeee',
      }
    ),
    boundaries_country: {
      'line-color': zoomRamp([4, '#f2e6e7'], [5, '#ebd6d8']),
      'line-width': zoomRamp([3, 1], [6, 1.5]),
      'line-dasharray': undefined,
    },
    // Keeps Protomaps' thinner line: unlike the default basemap's state borders, this layer also draws city districts
    boundaries: {
      'line-color': zoomRamp([5, '#ead5d7'], [6, '#e1c5c7']),
      'line-dasharray': ['step', ['zoom'], ['literal', [1, 0]], 7, ['literal', [2, 2]]],
    },
    places_country: {
      'text-color': zoomRamp([3, '#8a99a4'], [5, '#a1adb6'], [6, '#b9c2c9']),
      'text-halo-color': '#fafaf8',
    },
    places_region: { 'text-color': '#97a4ae', 'text-halo-color': '#fafaf8' },
    places_locality: { 'text-color': '#697b89', 'text-halo-color': 'rgba(255, 255, 255, 0.5)' },
    places_subplace: { 'text-color': '#697b89', 'text-halo-color': 'rgba(255, 255, 255, 0.5)' },
    water_label_ocean: { 'text-color': '#abb6be', 'text-halo-color': '#d4dadc' },
    water_label_lakes: { 'text-color': '#7a96a0', 'text-halo-color': '#f5f5f3' },
    water_waterway_label: { 'text-color': '#7a96a0', 'text-halo-color': '#f5f5f3' },
    roads_labels_major: { 'text-color': '#838383', 'text-halo-color': '#ffffff' },
    roads_labels_minor: { 'text-color': '#838383', 'text-halo-color': '#ffffff' },
  },
  [ProtomapsFlavor.Black]: {
    background: { 'background-color': '#0e0e0e' },
    earth: { 'fill-color': '#0e0e0e' },
    water: { 'fill-color': '#2c353c' },
    water_stream: { 'line-color': '#3f5a6d' },
    water_river: { 'line-color': '#3f5a6d' },
    buildings: defaultBasemapBuildings('#0e0e0e', '#393939'),
    ...defaultBasemapRoads(
      {
        highway: ['#1a1a1a', '#232323', '#494949'],
        major: ['#1a1a1a', '#232323', '#535666'],
        secondary: ['#414758', '#414758', '#414758'],
        minor: ['#414758', '#414758', '#414758'],
        // The dark default basemap fills service roads darker than the land, inside a lighter casing
        service: ['#1c1c1c', '#1c1c1c', '#0b0b0b'],
        other: ['#1c1c1c', '#1c1c1c', '#1c1c1c'],
      },
      {
        casing: '#232323',
        highway: '#414758',
        major: '#414758',
        secondary: '#161616',
        minor: '#161616',
        other: '#161616',
      }
    ),
    boundaries_country: {
      'line-color': zoomRamp([4, '#5c5e5e'], [5, '#606060'], [6, '#666666']),
      'line-width': zoomRamp([3, 1], [6, 1.5]),
      'line-dasharray': undefined,
    },
    boundaries: {
      'line-color': '#676772',
      'line-dasharray': ['step', ['zoom'], ['literal', [1, 0]], 7, ['literal', [2, 2]]],
    },
    places_country: {
      'text-color': zoomRamp([3, '#9eb6bd'], [5, '#767e89'], [6, '#788d93']),
      'text-halo-color': '#111111',
    },
    places_region: { 'text-color': '#cbe6e6', 'text-halo-color': '#111111' },
    places_locality: { 'text-color': '#ccd0e4', 'text-halo-color': '#222222' },
    places_subplace: { 'text-color': '#666666', 'text-halo-color': '#222222' },
    water_label_ocean: { 'text-color': '#6d7b81', 'text-halo-color': 'rgba(0, 0, 0, 0.7)' },
    water_label_lakes: { 'text-color': '#9b9b9b', 'text-halo-color': '#181818' },
    water_waterway_label: { 'text-color': '#a4a4a4', 'text-halo-color': '#181818' },
    roads_labels_major: { 'text-color': '#929292', 'text-halo-color': '#222222' },
    roads_labels_minor: { 'text-color': '#b5b4b4', 'text-halo-color': '#111111' },
  },
};

/**
 * 512px vector tiles run out one level short of the view's own zoom 0, so further out every style
 * rule falls below the style's first zoom stop and the basemap collapses to its background color.
 * Styling those resolutions as if they were the widest tile keeps the world drawn, only smaller.
 */
function clampStyleToWidestTile(layer: VectorTileLayer) {
  const tileGrid = layer.getSource()?.getTileGrid();
  const styleFunction = layer.getStyleFunction();
  if (!tileGrid || !styleFunction) {
    return;
  }
  const widest = tileGrid.getResolution(tileGrid.getMinZoom());
  layer.setStyle((feature, resolution) => styleFunction(feature, Math.min(resolution, widest)));
}

function resolveFlavor(flavor: ProtomapsFlavor | undefined, theme: GrafanaTheme2) {
  if (!flavor || flavor === ProtomapsFlavor.Auto) {
    return theme.isDark ? ProtomapsFlavor.Black : ProtomapsFlavor.White;
  }
  return flavor;
}

/** A trailing slash makes every asset resolve inside the configured path, not beside it */
function resolveServer(server?: string): URL {
  try {
    const url = new URL(server || DEV_SERVER_URL);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (!url.pathname.endsWith('/')) {
        url.pathname += '/';
      }
      return url;
    }
  } catch {}
  console.warn(`Ignoring Protomaps basemap server "${server}", using ${DEV_SERVER_URL}`);
  return new URL(DEV_SERVER_URL);
}

function createSource(delivery: TileDelivery | undefined, server: URL) {
  // ol-mapbox-style matches `source-layer` against this property, and a plain `layer` would collide
  // with the OpenStreetMap tag of the same name on roads and bridges.
  const format = new MVT({ layerName: 'mvt:layer' });
  if (delivery === TileDelivery.ZXY) {
    return new VectorTileSource({
      attributions: ATTRIBUTION,
      format,
      maxZoom: MAX_TILE_ZOOM,
      // URL() would percent-encode the template's braces
      url: `${new URL('tiles/', server).href}{z}/{x}/{y}.mvt`,
    });
  }
  return new PMTilesVectorSource({
    attributions: ATTRIBUTION,
    format,
    url: new URL('planet.pmtiles', server).href,
  });
}

/**
 * OpenLayers draws labels with CSS fonts rather than the style's glyph PBFs, and ol-mapbox-style
 * fetches any font the page lacks from a public CDN that the default CSP's `font-src 'self'`
 * blocks. Grafana already ships Inter in the weights Protomaps asks Noto Sans for.
 */
function toGrafanaFonts(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/^Noto Sans /, 'Inter ');
  }
  return Array.isArray(value) ? value.map(toGrafanaFonts) : value;
}

export function isProtomapsBasemapEnabled() {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaGeomapProtomapsBasemap, false);
}

function adaptStyle<T extends GlStyle>(glStyle: T, showLabels: boolean, flavor: ProtomapsFlavor): T {
  const defaultBasemapPaint = DEFAULT_BASEMAP_PAINT[flavor] ?? {};
  const layers = glStyle.layers
    .filter((layer) => (showLabels || layer.type !== 'symbol') && !UNLABELLED_LAYERS.has(layer.id))
    .map((layer) => withPaint(adaptLayer(layer), defaultBasemapPaint[layer.id]));
  return { ...glStyle, layers };
}

function withPaint<T extends GlLayer>(layer: T, paint: Paint | undefined): T {
  if (!paint) {
    return layer;
  }
  const merged = Object.entries({ ...layer.paint, ...paint }).filter(([, value]) => value !== undefined);
  return { ...layer, paint: Object.fromEntries(merged) };
}

function adaptLayer<T extends GlLayer>(layer: T): T {
  let adapted = layer;
  if (adapted.layout?.['text-font']) {
    adapted = { ...adapted, layout: { ...adapted.layout, 'text-font': toGrafanaFonts(adapted.layout['text-font']) } };
  }
  if (adapted.id === MINOR_ROAD_LABELS) {
    adapted = {
      ...adapted,
      minzoom: Math.max(adapted.minzoom ?? 0, MINOR_ROAD_LABEL_MIN_ZOOM),
      filter: MINOR_ROAD_LABEL_FILTER,
    };
  }
  if (adapted.id === POI_LABELS) {
    adapted = {
      ...adapted,
      minzoom: Math.max(adapted.minzoom ?? 0, POI_LABEL_MIN_ZOOM),
      filter: adapted.filter ? ['all', adapted.filter, PROMINENT_POI] : PROMINENT_POI,
    };
  }
  return adapted;
}

/** Protomaps widens roads exponentially with zoom, so they keep the same width on the ground */
function roadWidthRamp(...stops: Array<[number, number]>): GlValue {
  return ['interpolate', ['exponential', 1.6], ['zoom'], ...stops.flat()];
}

function zoomRamp(...stops: Array<[number, GlValue]>): GlValue {
  return ['interpolate', ['linear'], ['zoom'], ...stops.flat()];
}

export const protomaps: MapLayerRegistryItem<ProtomapsConfig> = {
  id: 'protomaps',
  name: 'Protomaps basemap (experimental)',
  description: 'Vector basemap from a Protomaps build',
  isBaseMap: true,
  requiresAttribution: true,
  defaultOptions: defaultProtomapsConfig,

  create: async (_map, options, _eventBus, theme) => {
    // Saved panels can still name this layer after the flag is turned off
    if (!isProtomapsBasemapEnabled()) {
      throw new Error('The Protomaps basemap needs the grafana.geomapProtomapsBasemap feature flag');
    }
    return createHandler(options.config, theme);
  },
};

function createHandler(config: ProtomapsConfig | undefined, theme: GrafanaTheme2): MapLayerHandler<ProtomapsConfig> {
  return {
    init: () => {
      const cfg = { ...defaultProtomapsConfig, ...config };
      const server = resolveServer(cfg.server);
      const flavor = resolveFlavor(cfg.flavor, theme);
      const styleUrl = new URL(`styles/${flavor}.json`, server).href;
      // A null style draws nothing, so tiles can load alongside the style request without flashing
      // OpenLayers' default blue.
      const layer = new VectorTileLayer({ declutter: true, source: createSource(cfg.delivery, server), style: null });

      fetch(styleUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }
          return response.json();
        })
        .then((glStyle: GlStyle) => {
          // ol-mapbox-style caches paint functions per style id, and the generated styles carry none
          const style = { ...adaptStyle(glStyle, !!cfg.showLabels, flavor), id: styleUrl };
          return Promise.all([
            applyStyle(layer, style, { source: SOURCE_ID, updateSource: false, styleUrl }),
            applyBackground(layer, style),
          ]);
        })
        .then(() => clampStyleToWidestTile(layer))
        .catch((error) => console.warn(`Failed to load Protomaps basemap style from ${styleUrl}:`, error));

      return layer;
    },

    registerOptionsUI: (builder) => {
      builder
        .addSelect({
          path: 'config.flavor',
          name: 'Flavor',
          settings: {
            options: [
              { value: ProtomapsFlavor.Auto, label: 'Auto', description: 'White or black to match the Grafana theme' },
              { value: ProtomapsFlavor.Light, label: 'Light' },
              { value: ProtomapsFlavor.Dark, label: 'Dark' },
              { value: ProtomapsFlavor.White, label: 'White', description: 'Muted light map for data on top' },
              { value: ProtomapsFlavor.Grayscale, label: 'Grayscale', description: 'Muted gray map for data on top' },
              { value: ProtomapsFlavor.Black, label: 'Black', description: 'Muted dark map for data on top' },
            ],
          },
          defaultValue: defaultProtomapsConfig.flavor,
        })
        .addBooleanSwitch({
          path: 'config.showLabels',
          name: 'Show labels',
          defaultValue: defaultProtomapsConfig.showLabels,
        })
        .addRadio({
          path: 'config.delivery',
          name: 'Tile delivery',
          settings: {
            options: [
              { value: TileDelivery.PMTiles, label: 'PMTiles', description: 'Range requests into one archive' },
              { value: TileDelivery.ZXY, label: 'ZXY', description: 'One URL per tile' },
            ],
          },
          defaultValue: defaultProtomapsConfig.delivery,
        })
        .addTextInput({
          path: 'config.server',
          name: 'Tile server',
          description: 'Base URL serving planet.pmtiles, tiles/, styles/ and sprites/',
          settings: {
            placeholder: DEV_SERVER_URL,
          },
        });
    },
  };
}

export const protomapsLayers = [protomaps];
