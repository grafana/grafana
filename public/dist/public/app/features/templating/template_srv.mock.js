import { variableRegex } from '../variables/utils';
/**
 * Mock for TemplateSrv where you can just supply map of key and values and it will do the interpolation based on that.
 * For simple tests whether you your data source for example calls correct replacing code.
 *
 * This is implementing TemplateSrv interface but that is not enough in most cases. Datasources require some additional
 * methods and usually require TemplateSrv class directly instead of just the interface which probably should be fixed
 * later on.
 */
var TemplateSrvMock = /** @class */ (function () {
    function TemplateSrvMock(variables) {
        this.variables = variables;
        this.regex = variableRegex;
    }
    TemplateSrvMock.prototype.getVariables = function () {
        return Object.keys(this.variables).map(function (key) {
            return {
                type: 'custom',
                name: key,
                label: key,
            };
        });
    };
    TemplateSrvMock.prototype.replace = function (target, scopedVars, format) {
        var _this = this;
        if (!target) {
            return target !== null && target !== void 0 ? target : '';
        }
        this.regex.lastIndex = 0;
        return target.replace(this.regex, function (match, var1, var2, fmt2, var3, fieldPath, fmt3) {
            var variableName = var1 || var2 || var3;
            return _this.variables[variableName];
        });
    };
    TemplateSrvMock.prototype.getVariableName = function (expression) {
        this.regex.lastIndex = 0;
        var match = this.regex.exec(expression);
        if (!match) {
            return null;
        }
        return match.slice(1).find(function (match) { return match !== undefined; });
    };
    return TemplateSrvMock;
}());
export { TemplateSrvMock };
//# sourceMappingURL=template_srv.mock.js.map