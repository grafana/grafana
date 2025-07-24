import { FeatureLike } from 'ol/Feature';
import OpenLayersMap from 'ol/Map';
import { unByKey } from 'ol/Observable';
import GeoJSON from 'ol/format/GeoJSON';
import VectorImage from 'ol/layer/VectorImage';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style } from 'ol/style';
import { ReplaySubject } from 'rxjs';
import { map as rxjsmap, first } from 'rxjs/operators';

import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  PluginState,
  EventBus,
  DataFrame,
} from '@grafana/data';
import { ComparisonOperation } from '@grafana/schema';
import { findField } from 'app/features/dimensions/utils';

import { StyleEditor } from '../../editor/StyleEditor';
import { polyStyle } from '../../style/markers';
import { defaultStyleConfig, StyleConfig, StyleConfigState } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { FeatureRuleConfig, FeatureStyleConfig } from '../../types';
import { checkFeatureMatchesStyleRule } from '../../utils/checkFeatureMatchesStyleRule';
import { getLayerPropertyInfo } from '../../utils/getFeatures';
import { getStyleDimension, getPublicGeoJSONFiles } from '../../utils/utils';


export interface DynamicGeoJSONMapperConfig {
  // URL for a geojson file
  src?: string;

  // The default style (applied if no rules match)
  style: StyleConfig;

  // Pick style based on a rule
  rules: FeatureStyleConfig[];
  idField?: string;
  dataStyle: StyleConfig;
}

const defaultOptions: DynamicGeoJSONMapperConfig = {
  src: 'public/maps/countries.geojson',
  rules: [],
  style: defaultStyleConfig,
  dataStyle: {},
};

interface StyleCheckerState {
  state: StyleConfigState;
  poly?: Style | Style[];
  point?: Style | Style[];
  rule?: FeatureRuleConfig;
}

export const DEFAULT_STYLE_RULE: FeatureStyleConfig = {
  style: defaultStyleConfig,
  check: {
    property: '',
    operation: ComparisonOperation.EQ,
    value: '',
  },
};

// Default configuration with tooltip support enabled
export const defaultDynamicGeoJSONConfig: MapLayerOptions<DynamicGeoJSONMapperConfig> = {
  type: 'dynamic-geojson',
  name: 'Dynamic GeoJSON',
  config: defaultOptions,
  tooltip: true,
};

export const dynamicGeoJSONLayer: MapLayerRegistryItem<DynamicGeoJSONMapperConfig> = {
  id: 'dynamic-geojson',
  name: 'Dynamic GeoJSON',
  description: 'Style a geojson file based on query results',
  isBaseMap: false,
  state: PluginState.alpha,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: OpenLayersMap, options: MapLayerOptions<DynamicGeoJSONMapperConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    const config = { ...defaultOptions, ...options.config };

    const source = new VectorSource({
      url: config.src,
      format: new GeoJSON(),
    });

    const features = new ReplaySubject<FeatureLike[]>();

    // Function to update feature properties for tooltip support
    const updateFeatureProperties = (frame?: DataFrame) => {
      updateFeaturePropertiesForTooltip(source, frame, config.idField, idToIdx);
    };

    const key = source.on('change', () => {
      //one geojson loads
      if (source.getState() === 'ready') {
        unByKey(key);
        features.next(source.getFeatures());
        // Apply current data to newly loaded features
        if (currentFrame) {
          updateFeatureProperties(currentFrame);
        }
      }
    });

    const styles: StyleCheckerState[] = [];
    if (config.rules) {
      for (const r of config.rules) {
        if (r.style) {
          const s = await getStyleConfigState(r.style);
          styles.push({
            state: s,
            rule: r.check,
          });
        }
      }
    }

    const s = await getStyleConfigState(config.style);
    styles.push({
      state: s,
    });


    const style = await getStyleConfigState(config.style);
    const idToIdx = new Map<string, number>();
    let currentFrame: DataFrame | undefined = undefined;

    const vectorLayer = new VectorImage({
      source,
      style: (feature: FeatureLike) => {
        const featureId = feature.getId();
        const idx = featureId != null ? idToIdx.get(String(featureId)) : undefined;
        const dims = style.dims;

        if (idx !== undefined && dims) {
          return new Style({
            fill: new Fill({ color: dims.color?.get(idx) }),
            stroke: new Stroke({ color: style.base.color, width: style.base.lineWidth ?? 1 }),
          });
        }

        const isPoint = feature.getGeometry()?.getType() === 'Point';

        for (const check of styles) {
          if (check.rule && !checkFeatureMatchesStyleRule(check.rule, feature)) {
            continue;
          }

          // Support dynamic values
          if (check.state.fields) {
            const values = { ...check.state.base };
            const { text } = check.state.fields;

            if (text) {
              values.text = `${feature.get(text)}`;
            }
            if (isPoint) {
              return check.state.maker(values);
            }
            return polyStyle(values);
          }

          // Lazy create the style object
          if (isPoint) {
            if (!check.point) {
              check.point = check.state.maker(check.state.base);
            }
            return check.point;
          }

          if (!check.poly) {
            check.poly = polyStyle(check.state.base);
          }
          return check.poly;
        }
        return undefined; // unreachable
      },
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        const frame = data.series[0];
        if (frame) {
          currentFrame = frame;
          
          // Update feature properties for tooltip support
          updateFeatureProperties(frame);
          
          // Update style dimensions for data-driven styling
          style.dims = getStyleDimension(frame, style, theme, config.dataStyle);
        }
        vectorLayer.changed();
      },
      registerOptionsUI: (builder) => {
        // get properties for first feature to use as ui options
        const layerInfo = features.pipe(
          first(),
          rxjsmap((v) => getLayerPropertyInfo(v))
        );

        builder
          .addSelect({
            path: 'config.src',
            name: 'GeoJSON URL',
            settings: {
              options: getPublicGeoJSONFiles() ?? [],
              allowCustomValue: true,
            },
            defaultValue: defaultOptions.src,
          })
          .addFieldNamePicker({
            path: 'config.idField',
            name: 'ID Field',
          })
          .addCustomEditor({
            id: 'config.dataStyle',
            path: 'config.dataStyle',
            name: 'Data style',
            editor: StyleEditor,
            settings: {
              displayRotation: false,
            },
            defaultValue: defaultOptions.dataStyle,
          })
          .addCustomEditor({
            id: 'config.style',
            path: 'config.style',
            name: 'Default style',
            description: 'The style to apply when no rules above match',
            editor: StyleEditor,
            settings: {
              simpleFixedValues: true,
              layerInfo,
            },
            defaultValue: defaultOptions.style,
          })
      },
    };
  },
  defaultOptions,
};

/**
 * Helper function to update feature properties for tooltip support
 * @param source - OpenLayers vector source containing features
 * @param frame - DataFrame containing the data
 * @param idField - Field name to use for matching feature IDs
 * @param idToIdx - Map to store ID to row index mappings
 */
export function updateFeaturePropertiesForTooltip(
  source: VectorSource,
  frame: DataFrame | undefined,
  idField: string | undefined,
  idToIdx: Map<string, number>
): void {
  if (!frame || !idField) {
    return;
  }
  
  const field = findField(frame, idField);
  if (field) {
    idToIdx.clear();
    field.values.forEach((v, i) => idToIdx.set(String(v), i));
    
    source.forEachFeature((feature) => {
      const featureId = feature.getId();
      if (featureId != null) {
        const rowIndex = idToIdx.get(String(featureId));
        if (rowIndex !== undefined) {
          // Set tooltip properties without overwriting existing GeoJSON properties
          feature.set('frame', frame);
          feature.set('rowIndex', rowIndex);
        }
      }
    });
  }
}
