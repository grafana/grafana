import { __extends } from "tslib";
import { OptionsVariableBuilder } from './optionsVariableBuilder';
var MultiVariableBuilder = /** @class */ (function (_super) {
    __extends(MultiVariableBuilder, _super);
    function MultiVariableBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    MultiVariableBuilder.prototype.withMulti = function (multi) {
        if (multi === void 0) { multi = true; }
        this.variable.multi = multi;
        return this;
    };
    MultiVariableBuilder.prototype.withIncludeAll = function (includeAll) {
        if (includeAll === void 0) { includeAll = true; }
        this.variable.includeAll = includeAll;
        return this;
    };
    MultiVariableBuilder.prototype.withAllValue = function (allValue) {
        this.variable.allValue = allValue;
        return this;
    };
    return MultiVariableBuilder;
}(OptionsVariableBuilder));
export { MultiVariableBuilder };
//# sourceMappingURL=multiVariableBuilder.js.map