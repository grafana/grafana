import { __extends } from "tslib";
import { VariableBuilder } from './variableBuilder';
var AdHocVariableBuilder = /** @class */ (function (_super) {
    __extends(AdHocVariableBuilder, _super);
    function AdHocVariableBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AdHocVariableBuilder.prototype.withDatasource = function (datasource) {
        this.variable.datasource = datasource;
        return this;
    };
    AdHocVariableBuilder.prototype.withFilters = function (filters) {
        this.variable.filters = filters;
        return this;
    };
    return AdHocVariableBuilder;
}(VariableBuilder));
export { AdHocVariableBuilder };
//# sourceMappingURL=adHocVariableBuilder.js.map