import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  PluginState,
} from '@grafana/data';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { unByKey } from 'ol/Observable';
import { checkFeatureMatchesStyleRule } from '../../utils/checkFeatureMatchesStyleRule';
import { ComparisonOperation, FeatureRuleConfig, FeatureStyleConfig } from '../../types';
import { Style } from 'ol/style';
import { FeatureLike } from 'ol/Feature';
import { GeomapStyleRulesEditor } from '../../editor/GeomapStyleRulesEditor';
import { defaultStyleConfig, StyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { polyStyle } from '../../style/markers';
import { StyleEditor } from './StyleEditor';
import { ReplaySubject } from 'rxjs';
import { map as rxjsmap, first } from 'rxjs/operators';
import { getLayerPropertyInfo } from '../../utils/getFeatures';

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
  poly: Style | Style[];
  point: Style | Style[];
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
  state: PluginState.beta,

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

    const features = new ReplaySubject<FeatureLike[]>();

    const key = source.on('change', () => {
      //one geojson loads
      if (source.getState() == 'ready') {
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
            point: s.maker(s.base),
            poly: polyStyle(s.base),
            rule: r.check,
          });
        }
      }
    }
    if (true) {
      const s = await getStyleConfigState(config.style);
      styles.push({
        point: s.maker(s.base),
        poly: polyStyle(s.base),
      });
    }

    const vectorLayer = new VectorLayer({
      source,
      style: (feature: FeatureLike) => {
        const isPoint = feature.getGeometry()?.getType() === 'Point';

        for (const check of styles) {
          if (check.rule && !checkFeatureMatchesStyleRule(check.rule, feature)) {
            continue;
          }
          return isPoint ? check.point : check.poly;
        }
        return undefined; // unreachable
      },
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        console.log('todo... find values matching the ID and update');
      },
      registerOptionsUI: (builder) => {
        // get properties for first feature to use as ui options
        const layerInfo = features.pipe(
          first(),
          rxjsmap((v) => getLayerPropertyInfo(v)),
        );

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
            id: 'config.rules',
            path: 'config.rules',
            name: 'Style Rules',
            description: 'Apply styles based on feature properties',
            editor: GeomapStyleRulesEditor,
            settings: {
              features: features,
              layerInfo: layerInfo,
            },
            defaultValue: [],
          })
          .addCustomEditor({
            id: 'config.style',
            path: 'config.style',
            name: 'Default Style',
            description: 'The style to apply when no rules above match',
            editor: StyleEditor,
            settings: {
              simpleFixedValues: true,
            },
            defaultValue: defaultOptions.style,
          });
      },
    };
  },
  defaultOptions,
};
