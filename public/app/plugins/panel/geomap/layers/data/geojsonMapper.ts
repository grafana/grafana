import { MapLayerRegistryItem, MapLayerOptions, PanelData, GrafanaTheme2, PluginState } from '@grafana/data';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';

export interface GeoJSONMapperConfig {
  // URL for a geojson file
  src?: string;

  // Field name that will map to each featureId
  idField?: string;

  // Field to use that will set color
  valueField?: string;
}

const defaultOptions: GeoJSONMapperConfig = {
  src: 'https://openlayers.org/en/latest/examples/data/geojson/countries.geojson',
};

export const geojsonMapper: MapLayerRegistryItem<GeoJSONMapperConfig> = {
  id: 'geojson-value-mapper',
  name: 'Map values to GeoJSON file',
  description: 'color features based on query results',
  isBaseMap: false,
  state: PluginState.alpha,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<GeoJSONMapperConfig>, theme: GrafanaTheme2) => {
    const config = { ...defaultOptions, ...options.config };

    const source = new VectorSource({
      url: config.src,
      format: new GeoJSON(),
    });

    const vectorLayer = new VectorLayer({
      source,
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        console.log( "todo... find values matching the ID and update");

        // Update each feature
        source.getFeatures().forEach( f => {
          console.log( "Find: ", f.getId(), f.getProperties() );
        });
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
