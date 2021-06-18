import { MapLayerRegistryItem, MapLayerConfig } from '@grafana/data';

import * as EL from 'esri-leaflet';

export interface EsriLayerOptions {
  token?: string;
}

// Streets
// Topographic
// NationalGeographic
// Oceans
// Gray
// DarkGray
// Imagery
// ImageryClarity (added in 2.1.3)
// ImageryFirefly (added in 2.2.0)
// ShadedRelief
// Terrain
// USATopo (added in 2.0.0)
// Physical (added in 2.2.0)

const streets: MapLayerRegistryItem<EsriLayerOptions> = {
  id: 'esri-basemap-streets',
  name: 'ESRI Streets',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (options: MapLayerConfig<EsriLayerOptions>) => ({
    init: () => {
      return EL.basemapLayer('Streets', options.config);
    },
  }),
};

const imagery: MapLayerRegistryItem<EsriLayerOptions> = {
  id: 'esri-basemap-imagery',
  name: 'ESRI Imagery',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (options: MapLayerConfig<EsriLayerOptions>) => ({
    init: () => {
      return EL.basemapLayer('Imagery', options.config);
    },
  }),
};

const topographic: MapLayerRegistryItem<EsriLayerOptions> = {
  id: 'esri-basemap-topo',
  name: 'ESRI Topographic',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (options: MapLayerConfig<EsriLayerOptions>) => ({
    init: () => {
      return EL.basemapLayer('Topographic', options.config);
    },
  }),
};

export const esriLayers = [streets, imagery, topographic];
