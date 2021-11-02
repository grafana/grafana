import { __extends } from "tslib";
/**
 * Enum with the different variable support types
 *
 * @alpha -- experimental
 */
export var VariableSupportType;
(function (VariableSupportType) {
    VariableSupportType["Legacy"] = "legacy";
    VariableSupportType["Standard"] = "standard";
    VariableSupportType["Custom"] = "custom";
    VariableSupportType["Datasource"] = "datasource";
})(VariableSupportType || (VariableSupportType = {}));
/**
 * Base class for VariableSupport classes
 *
 * @alpha -- experimental
 */
var VariableSupportBase = /** @class */ (function () {
    function VariableSupportBase() {
    }
    return VariableSupportBase;
}());
export { VariableSupportBase };
/**
 * Extend this class in a data source plugin to use the standard query editor for Query variables
 *
 * @alpha -- experimental
 */
var StandardVariableSupport = /** @class */ (function (_super) {
    __extends(StandardVariableSupport, _super);
    function StandardVariableSupport() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    StandardVariableSupport.prototype.getType = function () {
        return VariableSupportType.Standard;
    };
    return StandardVariableSupport;
}(VariableSupportBase));
export { StandardVariableSupport };
/**
 * Extend this class in a data source plugin to use a customized query editor for Query variables
 *
 * @alpha -- experimental
 */
var CustomVariableSupport = /** @class */ (function (_super) {
    __extends(CustomVariableSupport, _super);
    function CustomVariableSupport() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CustomVariableSupport.prototype.getType = function () {
        return VariableSupportType.Custom;
    };
    return CustomVariableSupport;
}(VariableSupportBase));
export { CustomVariableSupport };
/**
 * Extend this class in a data source plugin to use the query editor in the data source plugin for Query variables
 *
 * @alpha -- experimental
 */
var DataSourceVariableSupport = /** @class */ (function (_super) {
    __extends(DataSourceVariableSupport, _super);
    function DataSourceVariableSupport() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DataSourceVariableSupport.prototype.getType = function () {
        return VariableSupportType.Datasource;
    };
    return DataSourceVariableSupport;
}(VariableSupportBase));
export { DataSourceVariableSupport };
//# sourceMappingURL=variables.js.map