import OpenLayersMap from 'ol/Map';
import ImageLayer from 'ol/layer/Image';
import TileLayer from 'ol/layer/Tile';
import ImageArcGISRest from 'ol/source/ImageArcGISRest';
import XYZ from 'ol/source/XYZ';

import {
  MapLayerRegistryItem,
  MapLayerOptions,
  GrafanaTheme2,
  RegistryItem,
  Registry,
  EventBus,
  PanelData,
  textUtil,
} from '@grafana/data';

import { defaultXYZConfig, XYZConfig } from './generic';

interface PublicServiceItem extends RegistryItem {
  slug: string;
}

const CUSTOM_SERVICE = 'custom';
const CUSTOM_DYNAMIC_SERVICE = 'custom-dynamic';
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
  {
    id: CUSTOM_DYNAMIC_SERVICE,
    name: 'Custom Dynamic MapServer',
    description: 'Use a custom MapServer with dynamic values',
    slug: '',
  },
]);

export interface ESRIXYZConfig extends XYZConfig {
  server: string;
  refreshOnUpdate?: boolean;
}

export const esriXYZTiles: MapLayerRegistryItem<ESRIXYZConfig> = {
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
    const cfg = { ...options.config };
    const svc = publicServiceRegistry.getIfExists(cfg.server ?? DEFAULT_SERVICE)!;
    const noRepeat = options.noRepeat ?? false;
    const useDynamic = svc.id === CUSTOM_DYNAMIC_SERVICE;

    // Configure URL for built-in services
    if (svc.id !== CUSTOM_SERVICE && svc.id !== CUSTOM_DYNAMIC_SERVICE) {
      const base = 'https://services.arcgisonline.com/ArcGIS/rest/services/';
      cfg.url = `${base}${svc.slug}/MapServer/tile/{z}/{y}/{x}`;
      cfg.attribution = `Tiles © <a href="${base}${svc.slug}/MapServer">ArcGIS</a>`;
    }

    // Create layer based on service type
    let layer;
    let source;

    if (useDynamic) {
      const baseUrl = cfg.url ? cfg.url.replace(/\/tile\/\{z\}\/\{y\}\/\{x\}$/, '') : '';
      const sanitizedUrl = baseUrl ? textUtil.sanitizeUrl(baseUrl) : '';
      source = sanitizedUrl
        ? new ImageArcGISRest({ url: sanitizedUrl, params: {}, ratio: 1, attributions: cfg.attribution })
        : undefined;
      layer = new ImageLayer({ source });
    } else {
      source = new XYZ({ url: cfg.url, attributions: cfg.attribution, wrapX: !noRepeat });
      layer = new TileLayer({ source, minZoom: cfg.minZoom, maxZoom: cfg.maxZoom });
    }

    return {
      init: () => layer,
      update: (data: PanelData) => {
        if ((useDynamic || cfg.refreshOnUpdate) && source) {
          source.refresh();
        }
      },
      registerOptionsUI: (builder) => {
        builder
          .addSelect({
            path: 'config.server',
            name: 'Server instance',
            settings: { options: publicServiceRegistry.selectOptions().options },
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
          })
          .addBooleanSwitch({
            path: 'config.refreshOnUpdate',
            name: 'Refresh on update',
            description: 'Reload tiles when dashboard refreshes',
            defaultValue: false,
            showIf: (cfg) => cfg.config?.server === CUSTOM_SERVICE,
          })
          .addTextInput({
            path: 'config.url',
            name: 'URL template',
            description: 'URL to ArcGIS MapServer',
            settings: {
              placeholder: 'https://example.com/arcgis/rest/services/MyService/MapServer',
            },
            showIf: (cfg) => cfg.config?.server === CUSTOM_DYNAMIC_SERVICE,
          })
          .addTextInput({
            path: 'config.attribution',
            name: 'Attribution',
            settings: {
              placeholder: defaultXYZConfig.attribution,
            },
            showIf: (cfg) => cfg.config?.server === CUSTOM_DYNAMIC_SERVICE,
          });
      },
    };
  },

  defaultOptions: {
    server: DEFAULT_SERVICE,
  },
};

export const esriLayers = [esriXYZTiles];
