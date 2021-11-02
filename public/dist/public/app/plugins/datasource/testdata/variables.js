import { __extends } from "tslib";
import { StandardVariableSupport } from '@grafana/data';
var TestDataVariableSupport = /** @class */ (function (_super) {
    __extends(TestDataVariableSupport, _super);
    function TestDataVariableSupport() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TestDataVariableSupport.prototype.toDataQuery = function (query) {
        return {
            refId: 'TestDataDataSource-QueryVariable',
            stringInput: query.query,
            scenarioId: 'variables-query',
            csvWave: undefined,
        };
    };
    return TestDataVariableSupport;
}(StandardVariableSupport));
export { TestDataVariableSupport };
//# sourceMappingURL=variables.js.map