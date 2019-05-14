import _ from 'lodash';
import { assignModelProperties } from 'app/core/utils/model_utils';
/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * \$(\w+)                          $var1
 * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
 */
export var variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?::(\w+))?}/g;
// Helper function since lastIndex is not reset
export var variableRegexExec = function (variableString) {
    variableRegex.lastIndex = 0;
    return variableRegex.exec(variableString);
};
export var variableTypes = {};
export { assignModelProperties };
export function containsVariable() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var variableName = args[args.length - 1];
    args[0] = _.isString(args[0]) ? args[0] : Object['values'](args[0]).join(' ');
    var variableString = args.slice(0, -1).join(' ');
    var matches = variableString.match(variableRegex);
    var isMatchingVariable = matches !== null
        ? matches.find(function (match) {
            var varMatch = variableRegexExec(match);
            return varMatch !== null && varMatch.indexOf(variableName) > -1;
        })
        : false;
    return !!isMatchingVariable;
}
//# sourceMappingURL=variable.js.map