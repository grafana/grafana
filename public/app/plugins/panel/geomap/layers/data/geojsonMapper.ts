import { MapLayerRegistryItem, MapLayerOptions, PanelData, GrafanaTheme2, PluginState } from '@grafana/data';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Feature } from 'ol';
import { Geometry } from 'ol/geom';
import { GeoMapStyle, getGeoMapStyle } from '../../utils/getGeoMapStyle';
import { checkFeatureMatchesStyleRule } from '../../utils/checkFeatureMatchesStyleRule';
export interface GeoJSONMapperConfig {
  // URL for a geojson file
  src?: string;

  // Field name that will map to each featureId
  idField?: string;

  // Field to use that will set color
  valueField?: string;

  // Styles that can be applied
  styles?: GeoMapStyle[];
}

const defaultOptions: GeoJSONMapperConfig = {
  src: 'public/maps/countries.geojson',
  styles: [],
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
      style: (feature: Feature<Geometry>) => {
        if (!feature) {
          return undefined;
        }
        if (config?.styles?.length) {
          for (const style of config.styles) {
            //check if there is no style rule or if the rule matches feature property
            if (!style.rule || checkFeatureMatchesStyleRule(style.rule, feature)) {
              return getGeoMapStyle(style, feature);
            }
          }
        }
        return undefined;
      }
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        console.log('todo... find values matching the ID and update');

        // Update each feature
        source.getFeatures().forEach((f) => {
          console.log('Find: ', f.getId(), f.getProperties());
        });
      },
    };
  },

  // Geojson source url
  registerOptionsUI: (builder) => {
    builder.addSelect({
      path: 'config.src',
      name: 'GeoJSON URL',
      settings: {
        options: [
          { label: 'public/maps/countries.geojson', value: 'public/maps/countries.geojson' },
          { label: 'public/maps/usa-states.geojson', value: 'public/maps/usa-states.geojson' },
        ],
        allowCustomValue: true,
      },
      defaultValue: defaultOptions.src,
    })

    ;
  },

  // fill in the default values
  defaultOptions,
};
