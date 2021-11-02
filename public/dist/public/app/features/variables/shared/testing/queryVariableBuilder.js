import { __extends } from "tslib";
import { DatasourceVariableBuilder } from './datasourceVariableBuilder';
var QueryVariableBuilder = /** @class */ (function (_super) {
    __extends(QueryVariableBuilder, _super);
    function QueryVariableBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    QueryVariableBuilder.prototype.withDatasource = function (datasource) {
        this.variable.datasource = datasource;
        return this;
    };
    return QueryVariableBuilder;
}(DatasourceVariableBuilder));
export { QueryVariableBuilder };
//# sourceMappingURL=queryVariableBuilder.js.map