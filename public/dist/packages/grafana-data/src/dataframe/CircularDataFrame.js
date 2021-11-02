import { __assign, __extends } from "tslib";
import { MutableDataFrame } from './MutableDataFrame';
import { CircularVector } from '../vector/CircularVector';
/**
 * This dataframe can have values constantly added, and will never
 * exceed the given capacity
 */
var CircularDataFrame = /** @class */ (function (_super) {
    __extends(CircularDataFrame, _super);
    function CircularDataFrame(options) {
        return _super.call(this, undefined, function (buffer) {
            return new CircularVector(__assign(__assign({}, options), { buffer: buffer }));
        }) || this;
    }
    return CircularDataFrame;
}(MutableDataFrame));
export { CircularDataFrame };
//# sourceMappingURL=CircularDataFrame.js.map