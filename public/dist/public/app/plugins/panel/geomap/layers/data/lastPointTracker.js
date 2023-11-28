import { __awaiter } from "tslib";
import Feature from 'ol/Feature';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import * as style from 'ol/style';
import { PluginState } from '@grafana/data';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';
const defaultOptions = {
    icon: 'https://openlayers.org/en/latest/examples/data/icon.png',
};
export const lastPointTracker = {
    id: 'last-point-tracker',
    name: 'Icon at last point',
    description: 'Show an icon at the last point',
    isBaseMap: false,
    showLocation: true,
    state: PluginState.alpha,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: (map, options, eventBus, theme) => __awaiter(void 0, void 0, void 0, function* () {
        const point = new Feature({});
        const config = Object.assign(Object.assign({}, defaultOptions), options.config);
        point.setStyle(new style.Style({
            image: new style.Icon({
                src: config.icon,
            }),
        }));
        const vectorSource = new source.Vector({
            features: [point],
        });
        const vectorLayer = new layer.Vector({
            source: vectorSource,
        });
        const matchers = yield getLocationMatchers(options.location);
        return {
            init: () => vectorLayer,
            update: (data) => {
                const frame = data.series[0];
                if (frame && frame.length) {
                    const out = getGeometryField(frame, matchers);
                    if (!out.field) {
                        return; // ???
                    }
                    point.setGeometry(out.field.values[frame.length - 1]);
                }
            },
        };
    }),
    // fill in the default values
    defaultOptions,
};
//# sourceMappingURL=lastPointTracker.js.map