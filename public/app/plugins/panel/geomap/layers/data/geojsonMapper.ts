import { MapLayerRegistryItem, MapLayerOptions, PanelData, GrafanaTheme2, PluginState } from '@grafana/data';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Stroke, Fill } from 'ol/style'; 
import { ColorDimensionConfig } from 'app/features/dimensions';

export interface GeoJSONMapperConfig {
  // URL for a geojson file
  src?: string;

  // Field name that will map to each featureId
  idField?: string;

  // Field to use that will set color
  valueField?: string;

  // Styles that can be applied
  styles?: GeoMapStyle[];

  // Rule specific to feature property to apply style
  featureStyleRules?: GeoJSONMapperRule[];
}
interface GeoJSONMapperRule {
  property: string;
  comparisonType: string;
  comparisonValue: string;
  styleIndex: string;
}
interface GeoMapStyle {
  shape?: string;
  fill?: ColorDimensionConfig;
  stroke?: ColorDimensionConfig;
  strokeWidth?: number;
}

const defaultOptions: GeoJSONMapperConfig = {
  src: 'public/maps/countries.geojson',
  styles: [],
  featureStyleRules: [],
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

    const customStyles: Style[] = [];
    if (config?.styles) {
      const configStyles = config.styles;
      for (let s = 0; s < configStyles.length; s++) {
        customStyles[s] = new Style({
          fill: configStyles[s].fill && new Fill({
            color: `${configStyles[s].fill}`,
          }),
          stroke: configStyles[s].stroke && new Stroke({
            color: `${configStyles[s].stroke}`,
            width: Number(configStyles[s].strokeWidth)
          })
        }) 
      }
      //add shape
    }

    const vectorLayer = new VectorLayer({
      source,
      style: function (feature) {
        if (!feature) {
          return undefined;
        }
        let style = undefined;
        const styleRules = config?.featureStyleRules;
        if (styleRules?.length) {
          const featProps = feature.getProperties();
          for (let rule = 0; rule < styleRules.length; rule++) {
            switch (styleRules[rule].comparisonType) {
              case "equals":
                if (featProps[styleRules[rule].property] === styleRules[rule].comparisonValue) {
                  style = customStyles[Number(styleRules[rule].styleIndex)];
                }
                break;
              case "greater":
                if (featProps[styleRules[rule].property] > styleRules[rule].comparisonValue) {
                  style = customStyles[Number(styleRules[rule].styleIndex)];
                }
                break;
              case "lesser":
                if (featProps[styleRules[rule].property] < styleRules[rule].comparisonValue) {
                  style = customStyles[Number(styleRules[rule].styleIndex)];
                }
                break; 
            }
          }
        }
        return style;
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
