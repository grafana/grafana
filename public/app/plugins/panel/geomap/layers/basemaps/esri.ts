import type OpenLayersMap from 'ol/Map';

import {
  type MapLayerRegistryItem,
  type MapLayerOptions,
  type GrafanaTheme2,
  type RegistryItem,
  Registry,
  type EventBus,
  type PanelOptionsEditorBuilder,
} from '@grafana/data';

import { xyzTiles, defaultXYZConfig, resolveXYZConfig, type XYZConfig } from './generic';

interface PublicServiceItem extends RegistryItem {
  slug: string;
}

const CUSTOM_SERVICE = 'custom';
const DEFAULT_SERVICE = 'streets';

const publicServiceRegistry = new Registry<PublicServiceItem>(() => [
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

export type ESRIXYZConfig = Partial<XYZConfig> & {
  server?: string;
};

const registerOptionsUI = (builder: PanelOptionsEditorBuilder<MapLayerOptions<ESRIXYZConfig>>) => {
  builder
    .addSelect({
      path: 'config.server',
      name: 'Server instance',
      settings: {
        options: publicServiceRegistry.selectOptions().options,
      },
    })
    .addTextInput({
      path: 'config.url',
      name: 'URL template',
      description: 'Must include {x}, {y} or {-y}, and {z} placeholders',
      settings: {
        placeholder: defaultXYZConfig.url,
      },
      showIf: (cfg) => cfg.config?.server === CUSTOM_SERVICE,
    })
    .addTextInput({
      path: 'config.attribution',
      name: 'Attribution',
      settings: {
        placeholder: defaultXYZConfig.attribution,
      },
      showIf: (cfg) => cfg.config?.server === CUSTOM_SERVICE,
    });
};

const esriXYZTiles: MapLayerRegistryItem<ESRIXYZConfig> = {
  id: 'esri-xyz',
  name: 'ArcGIS MapServer',
  description: 'Add layer from an ESRI ArcGIS MapServer',
  isBaseMap: true,

  create: async (
    map: OpenLayersMap,
    options: MapLayerOptions<ESRIXYZConfig>,
    eventBus: EventBus,
    theme: GrafanaTheme2
  ) => {
    const cfg = resolveXYZConfig<ESRIXYZConfig>(options.config ?? {});
    const svc = publicServiceRegistry.getIfExists(cfg.server ?? DEFAULT_SERVICE)!;
    if (svc.id !== CUSTOM_SERVICE) {
      const base = 'https://services.arcgisonline.com/ArcGIS/rest/services/';
      cfg.url = `${base}${svc.slug}/MapServer/tile/{z}/{y}/{x}`;
      cfg.attribution = `Tiles © <a href="${base}${svc.slug}/MapServer">ArcGIS</a>`;
    }
    const opts = { ...options, config: cfg };
    const xyz = await xyzTiles.create(map, opts, eventBus, theme);

    return { ...xyz, registerOptionsUI };
  },

  defaultOptions: {
    server: DEFAULT_SERVICE,
  },
};

export const esriLayers = [esriXYZTiles];
