import { MapLayerRegistryItem, MapLayerConfig, GrafanaTheme2, RegistryItem, Registry } from '@grafana/data';
import Map from 'ol/Map';
import { xyzTiles, defaultXYZConfig, XYZConfig } from './generic';

interface PublicServiceItem extends RegistryItem {
  slug: string;
}

const CUSTOM_SERVICE = 'custom';
const DEFAULT_SERVICE = 'streets';

export const publicServiceRegistry = new Registry<PublicServiceItem>(() => [
  {
    id: DEFAULT_SERVICE,
    name: 'World Street Map',
    slug: 'World_Street_Map',
  },
  {
    id: 'world-imagery',
    name: 'World Imagery',
    slug: 'World_Imagery',
  },
  {
    id: 'world-physical',
    name: 'World Physical',
    slug: 'World_Physical_Map',
  },
  {
    id: 'topo',
    name: 'Topographic',
    slug: 'World_Topo_Map',
  },
  {
    id: 'usa-topo',
    name: 'USA Topographic',
    slug: 'USA_Topo_Maps',
  },
  {
    id: 'ocean',
    name: 'World Ocean',
    slug: 'Ocean/World_Ocean_Base',
  },
  {
    id: CUSTOM_SERVICE,
    name: 'Custom MapServer',
    description: 'Use a custom MapServer with pre-cached values',
    slug: '',
  },
]);

export interface ESRIXYZConfig extends XYZConfig {
  server: string;
}

export const esriXYZTiles: MapLayerRegistryItem<ESRIXYZConfig> = {
  id: 'esri-xyz',
  name: 'ArcGIS MapServer',
  isBaseMap: true,

  create: (map: Map, options: MapLayerConfig<ESRIXYZConfig>, theme: GrafanaTheme2) => ({
    init: () => {
      const cfg = { ...options.config };
      const svc = publicServiceRegistry.getIfExists(cfg.server ?? DEFAULT_SERVICE)!;
      if (svc.id !== CUSTOM_SERVICE) {
        const base = 'https://services.arcgisonline.com/ArcGIS/rest/services/';
        cfg.url = `${base}${svc.slug}/MapServer/tile/{z}/{y}/{x}`;
        cfg.attribution = `Tiles © <a href="${base}${svc.slug}/MapServer">ArcGIS</a>`;
      }
      // reuse the standard XYZ tile logic
      return xyzTiles.create(map, { ...options, config: cfg as XYZConfig }, theme).init();
    },
  }),

  registerOptionsUI: (builder) => {
    builder
      .addSelect({
        path: 'server',
        name: 'Server instance',
        settings: {
          options: publicServiceRegistry.selectOptions().options,
        },
      })
      .addTextInput({
        path: 'url',
        name: 'URL template',
        description: 'Must include {x}, {y} or {-y}, and {z} placeholders',
        settings: {
          placeholder: defaultXYZConfig.url,
        },
        showIf: (cfg) => cfg.server === CUSTOM_SERVICE,
      })
      .addTextInput({
        path: 'attribution',
        name: 'Attribution',
        settings: {
          placeholder: defaultXYZConfig.attribution,
        },
        showIf: (cfg) => cfg.server === CUSTOM_SERVICE,
      });
  },

  defaultOptions: {
    server: DEFAULT_SERVICE,
  },
};

export const esriLayers = [esriXYZTiles];
