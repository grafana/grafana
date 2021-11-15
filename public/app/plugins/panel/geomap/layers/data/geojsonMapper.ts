import { MapLayerRegistryItem, MapLayerOptions, PanelData, GrafanaTheme2, PluginState } from '@grafana/data';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { unByKey } from 'ol/Observable';
import { Feature } from 'ol';
import { Geometry } from 'ol/geom';
import { getGeoMapStyle } from '../../utils/getGeoMapStyle';
import { checkFeatureMatchesStyleRule } from '../../utils/checkFeatureMatchesStyleRule';
import { ComparisonOperation, FeatureStyleConfig } from '../../types';
import { Stroke, Style } from 'ol/style';
import { FeatureLike } from 'ol/Feature';
import { GeomapStyleRulesEditor } from '../../editor/GeomapStyleRulesEditor';
import { circleMarker } from '../../style/markers';
export interface GeoJSONMapperConfig {
  // URL for a geojson file
  src?: string;

  // Styles that can be applied
  styles: FeatureStyleConfig[];
}

const defaultOptions: GeoJSONMapperConfig = {
  src: 'public/maps/countries.geojson',
  styles: [],
};

export const DEFAULT_STYLE_RULE: FeatureStyleConfig = {
  fillColor: '#1F60C4',
  strokeWidth: 1,
  rule: {
    property: '',
    operation: ComparisonOperation.EQ,
    value: '',
  },
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

    const key = source.on('change', () => {
      if (source.getState() == 'ready') {
        unByKey(key);
        // var olFeatures = source.getFeatures(); // olFeatures.length === 1
        // window.setTimeout(function () {
        //     var olFeatures = source.getFeatures(); // olFeatures.length > 1
        //     // Only after using setTimeout can I search the feature list... :(
        // }, 100)

        console.log('SOURCE READY!!!', source.getFeatures().length);
      }
    });

    const defaultStyle = new Style({
      stroke: new Stroke({
        color: DEFAULT_STYLE_RULE.fillColor,
        width: DEFAULT_STYLE_RULE.strokeWidth,
      }),
    });

    const vectorLayer = new VectorLayer({
      source,
      style: (feature: FeatureLike) => {
        const type = feature.getGeometry()?.getType();
        if (type === 'Point') {
          return circleMarker({color:DEFAULT_STYLE_RULE.fillColor});
        }

        if (feature && config?.styles?.length) {
          for (const style of config.styles) {
            //check if there is no style rule or if the rule matches feature property
            if (!style.rule || checkFeatureMatchesStyleRule(style.rule, feature as Feature<Geometry>)) {
              return getGeoMapStyle(style, feature);
            }
          }
        }
        return defaultStyle;
      },
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        console.log('todo... find values matching the ID and update');

        // // Update each feature
        // source.getFeatures().forEach((f) => {
        //   console.log('Find: ', f.getId(), f.getProperties());
        // });
      },

      // Geojson source url
      registerOptionsUI: (builder) => {
        const features = source.getFeatures();
        console.log('FEATURES', source.getState(), features.length, options);

        builder
          .addSelect({
            path: 'config.src',
            name: 'GeoJSON URL',
            settings: {
              options: [
                { label: 'public/maps/countries.geojson', value: 'public/maps/countries.geojson' },
                { label: 'public/maps/usa-states.geojson', value: 'public/maps/usa-states.geojson' },
                { label: 'public/gazetteer/airports.geojson', value: 'public/gazetteer/airports.geojson' },
              ],
              allowCustomValue: true,
            },
            defaultValue: defaultOptions.src,
          })
          .addCustomEditor({
            id: 'config.styles',
            path: 'config.styles',
            name: 'Style Rules',
            editor: GeomapStyleRulesEditor,
            settings: {},
            defaultValue: [],
          });
      },
    };
  },
  defaultOptions,
};
