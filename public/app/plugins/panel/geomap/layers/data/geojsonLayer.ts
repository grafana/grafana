import { FeatureLike } from 'ol/Feature';
import Map from 'ol/Map';
import { unByKey } from 'ol/Observable';
import GeoJSON from 'ol/format/GeoJSON';
import VectorImage from 'ol/layer/VectorImage';
import VectorSource from 'ol/source/Vector';
import { Style } from 'ol/style';
import { ReplaySubject } from 'rxjs';
import { map as rxjsmap, first } from 'rxjs/operators';

import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2, EventBus } from '@grafana/data';
import { ComparisonOperation } from '@grafana/schema';

import { GeomapStyleRulesEditor } from '../../editor/GeomapStyleRulesEditor';
import { StyleEditor } from '../../editor/StyleEditor';
import { polyStyle } from '../../style/markers';
import {
  defaultStyleConfig,
  GeoJSONLineStyles,
  GeoJSONPointStyles,
  GeoJSONPolyStyles,
  StyleConfig,
  StyleConfigState,
  StyleConfigValues,
} from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { FeatureRuleConfig, FeatureStyleConfig } from '../../types';
import { checkFeatureMatchesStyleRule } from '../../utils/checkFeatureMatchesStyleRule';
import { getLayerPropertyInfo } from '../../utils/getFeatures';
import { getPublicGeoJSONFiles } from '../../utils/utils';

export interface GeoJSONMapperConfig {
  // URL for a geojson file
  src?: string;

  // Pick style based on a rule
  rules: FeatureStyleConfig[];

  // The default style (applied if no rules match)
  style: StyleConfig;
}

const defaultOptions: GeoJSONMapperConfig = {
  src: 'public/maps/countries.geojson',
  rules: [],
  style: defaultStyleConfig,
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

export const geojsonLayer: MapLayerRegistryItem<GeoJSONMapperConfig> = {
  id: 'geojson',
  name: 'GeoJSON',
  description: 'Load static data from a geojson file',
  isBaseMap: false,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<GeoJSONMapperConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    const config = { ...defaultOptions, ...options.config };

    const source = new VectorSource({
      url: config.src,
      format: new GeoJSON(),
    });

    const features = new ReplaySubject<FeatureLike[]>();

    const key = source.on('change', () => {
      //one geojson loads
      if (source.getState() === 'ready') {
        unByKey(key);
        features.next(source.getFeatures());
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

    const polyStyleStrings: string[] = Object.values(GeoJSONPolyStyles);
    const pointStyleStrings: string[] = Object.values(GeoJSONPointStyles);
    const lineStyleStrings: string[] = Object.values(GeoJSONLineStyles);
    const vectorLayer = new VectorImage({
      source,
      style: (feature: FeatureLike) => {
        const featureType = feature.getGeometry()?.getType();
        const isPoint = featureType === 'Point' || featureType === 'MultiPoint';
        const isPolygon = featureType === 'Polygon' || featureType === 'MultiPolygon';
        const isLine = featureType === 'LineString' || featureType === 'MultiLineString';

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

          // Support styling polygons from Feature properties
          const featureProps = feature.getProperties();
          if (isPolygon && Object.keys(featureProps).some((property) => polyStyleStrings.includes(property))) {
            const values: StyleConfigValues = {
              color: featureProps[GeoJSONPolyStyles.color] ?? check.state.base.color,
              opacity: featureProps[GeoJSONPolyStyles.opacity] ?? check.state.base.opacity,
              lineWidth: featureProps[GeoJSONPolyStyles.lineWidth] ?? check.state.base.lineWidth,
            };
            return polyStyle(values);
          } else if (isLine && Object.keys(featureProps).some((property) => lineStyleStrings.includes(property))) {
            const values: StyleConfigValues = {
              color: featureProps[GeoJSONLineStyles.color] ?? check.state.base.color,
              lineWidth: featureProps[GeoJSONLineStyles.lineWidth] ?? check.state.base.lineWidth,
            };
            return check.state.maker(values);
          } else if (isPoint && Object.keys(featureProps).some((property) => pointStyleStrings.includes(property))) {
            const values: StyleConfigValues = {
              color: featureProps[GeoJSONPointStyles.color] ?? check.state.base.color,
              size: featureProps[GeoJSONPointStyles.size] ?? check.state.base.size,
            };
            return check.state.maker(values);
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
          .addCustomEditor({
            id: 'config.rules',
            path: 'config.rules',
            name: 'Style rules',
            description: 'Apply styles based on feature properties',
            editor: GeomapStyleRulesEditor,
            settings: {
              features,
              layerInfo,
            },
            defaultValue: [],
          });
      },
    };
  },
  defaultOptions,
};
