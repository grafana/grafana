import { __assign } from "tslib";
import { IndexVector } from '@grafana/data';
/** @internal
 * Given a sparkline config returns a DataFrame ready to be turned into Plot data set
 **/
export function preparePlotFrame(sparkline, config) {
    var _a;
    var length = sparkline.y.values.length;
    var yFieldConfig = __assign(__assign({}, sparkline.y.config), config);
    return {
        refId: 'sparkline',
        fields: [
            (_a = sparkline.x) !== null && _a !== void 0 ? _a : IndexVector.newField(length),
            __assign(__assign({}, sparkline.y), { config: yFieldConfig }),
        ],
        length: length,
    };
}
//# sourceMappingURL=utils.js.map