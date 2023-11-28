import { __awaiter } from "tslib";
import { unByKey } from 'ol/Observable';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { ReplaySubject } from 'rxjs';
import { map as rxjsmap, first } from 'rxjs/operators';
import { ComparisonOperation } from '@grafana/schema';
import { GeomapStyleRulesEditor } from '../../editor/GeomapStyleRulesEditor';
import { StyleEditor } from '../../editor/StyleEditor';
import { polyStyle } from '../../style/markers';
import { defaultStyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { checkFeatureMatchesStyleRule } from '../../utils/checkFeatureMatchesStyleRule';
import { getLayerPropertyInfo } from '../../utils/getFeatures';
import { getPublicGeoJSONFiles } from '../../utils/utils';
const defaultOptions = {
    src: 'public/maps/countries.geojson',
    rules: [],
    style: defaultStyleConfig,
};
export const DEFAULT_STYLE_RULE = {
    style: defaultStyleConfig,
    check: {
        property: '',
        operation: ComparisonOperation.EQ,
        value: '',
    },
};
export const geojsonLayer = {
    id: 'geojson',
    name: 'GeoJSON',
    description: 'Load static data from a geojson file',
    isBaseMap: false,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: (map, options, eventBus, theme) => __awaiter(void 0, void 0, void 0, function* () {
        const config = Object.assign(Object.assign({}, defaultOptions), options.config);
        const source = new VectorSource({
            url: config.src,
            format: new GeoJSON(),
        });
        const features = new ReplaySubject();
        const key = source.on('change', () => {
            //one geojson loads
            if (source.getState() === 'ready') {
                unByKey(key);
                features.next(source.getFeatures());
            }
        });
        const styles = [];
        if (config.rules) {
            for (const r of config.rules) {
                if (r.style) {
                    const s = yield getStyleConfigState(r.style);
                    styles.push({
                        state: s,
                        rule: r.check,
                    });
                }
            }
        }
        if (true) {
            const s = yield getStyleConfigState(config.style);
            styles.push({
                state: s,
            });
        }
        const vectorLayer = new VectorLayer({
            source,
            style: (feature) => {
                var _a;
                const isPoint = ((_a = feature.getGeometry()) === null || _a === void 0 ? void 0 : _a.getType()) === 'Point';
                for (const check of styles) {
                    if (check.rule && !checkFeatureMatchesStyleRule(check.rule, feature)) {
                        continue;
                    }
                    // Support dynamic values
                    if (check.state.fields) {
                        const values = Object.assign({}, check.state.base);
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
            registerOptionsUI: (builder) => {
                var _a;
                // get properties for first feature to use as ui options
                const layerInfo = features.pipe(first(), rxjsmap((v) => getLayerPropertyInfo(v)));
                builder
                    .addSelect({
                    path: 'config.src',
                    name: 'GeoJSON URL',
                    settings: {
                        options: (_a = getPublicGeoJSONFiles()) !== null && _a !== void 0 ? _a : [],
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
    }),
    defaultOptions,
};
//# sourceMappingURL=geojsonLayer.js.map