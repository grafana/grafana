import { __extends } from "tslib";
import { MultiVariableBuilder } from './multiVariableBuilder';
var DatasourceVariableBuilder = /** @class */ (function (_super) {
    __extends(DatasourceVariableBuilder, _super);
    function DatasourceVariableBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DatasourceVariableBuilder.prototype.withRefresh = function (refresh) {
        this.variable.refresh = refresh;
        return this;
    };
    DatasourceVariableBuilder.prototype.withRegEx = function (regex) {
        this.variable.regex = regex;
        return this;
    };
    return DatasourceVariableBuilder;
}(MultiVariableBuilder));
export { DatasourceVariableBuilder };
//# sourceMappingURL=datasourceVariableBuilder.js.map