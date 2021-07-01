import { MapLayerRegistryItem, MapLayerConfig, MapLayerHandler, PanelData, GrafanaTheme2 } from '@grafana/data';
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

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig<GeoJSONMapperConfig>, theme: GrafanaTheme2): MapLayerHandler => {
    const config = { ...defaultOptions, ...options.config };

    const source = new VectorSource({
      url: config.src,
      format: new GeoJSON(),
    });

    const vectorLayer = new VectorLayer({
      source,
    });

    // ?? has it loaded yet?
    const ids = source.getFeatures().map( f => f.getId() );
    console.log( "Feature IDs", ids );

    return {
      init: () => vectorLayer,
      update: (map: Map, data: PanelData) => {
        console.log( "todo... find values matching the ID and update");
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
