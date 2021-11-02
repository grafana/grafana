import { __assign, __rest } from "tslib";
import { cloneDeep } from 'lodash';
var VariableBuilder = /** @class */ (function () {
    function VariableBuilder(initialState) {
        var id = initialState.id, index = initialState.index, global = initialState.global, rest = __rest(initialState, ["id", "index", "global"]);
        this.variable = cloneDeep(__assign(__assign({}, rest), { name: rest.type }));
    }
    VariableBuilder.prototype.withName = function (name) {
        this.variable.name = name;
        return this;
    };
    VariableBuilder.prototype.withId = function (id) {
        this.variable.id = id;
        return this;
    };
    VariableBuilder.prototype.build = function () {
        return this.variable;
    };
    return VariableBuilder;
}());
export { VariableBuilder };
//# sourceMappingURL=variableBuilder.js.map