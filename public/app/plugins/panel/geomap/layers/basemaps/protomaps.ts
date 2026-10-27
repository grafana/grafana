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
    return theme.isDark ? ProtomapsFlavor.Dark : ProtomapsFlavor.Light;
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

function adaptStyle<T extends GlStyle>(glStyle: T, showLabels: boolean): T {
  const layers = glStyle.layers
    .filter((layer) => (showLabels || layer.type !== 'symbol') && !UNLABELLED_LAYERS.has(layer.id))
    .map(adaptLayer);
  return { ...glStyle, layers };
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
      const styleUrl = new URL(`styles/${resolveFlavor(cfg.flavor, theme)}.json`, server).href;
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
          const style = { ...adaptStyle(glStyle, !!cfg.showLabels), id: styleUrl };
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
              { value: ProtomapsFlavor.Auto, label: 'Auto', description: 'Light or dark to match the Grafana theme' },
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
