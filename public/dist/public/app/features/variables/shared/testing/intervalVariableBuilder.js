import { __extends } from "tslib";
import { OptionsVariableBuilder } from './optionsVariableBuilder';
var IntervalVariableBuilder = /** @class */ (function (_super) {
    __extends(IntervalVariableBuilder, _super);
    function IntervalVariableBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    IntervalVariableBuilder.prototype.withRefresh = function (refresh) {
        this.variable.refresh = refresh;
        return this;
    };
    IntervalVariableBuilder.prototype.withAuto = function (auto) {
        this.variable.auto = auto;
        return this;
    };
    IntervalVariableBuilder.prototype.withAutoCount = function (autoCount) {
        this.variable.auto_count = autoCount;
        return this;
    };
    IntervalVariableBuilder.prototype.withAutoMin = function (autoMin) {
        this.variable.auto_min = autoMin;
        return this;
    };
    return IntervalVariableBuilder;
}(OptionsVariableBuilder));
export { IntervalVariableBuilder };
//# sourceMappingURL=intervalVariableBuilder.js.map