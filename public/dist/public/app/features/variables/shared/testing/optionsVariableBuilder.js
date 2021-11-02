import { __extends } from "tslib";
import { VariableBuilder } from './variableBuilder';
var OptionsVariableBuilder = /** @class */ (function (_super) {
    __extends(OptionsVariableBuilder, _super);
    function OptionsVariableBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OptionsVariableBuilder.prototype.withOptions = function () {
        var texts = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            texts[_i] = arguments[_i];
        }
        this.variable.options = [];
        for (var index = 0; index < texts.length; index++) {
            this.variable.options.push({
                text: texts[index],
                value: texts[index],
                selected: false,
            });
        }
        return this;
    };
    OptionsVariableBuilder.prototype.withoutOptions = function () {
        this.variable.options = undefined;
        return this;
    };
    OptionsVariableBuilder.prototype.withCurrent = function (text, value) {
        this.variable.current = {
            text: text,
            value: value !== null && value !== void 0 ? value : text,
            selected: true,
        };
        return this;
    };
    OptionsVariableBuilder.prototype.withQuery = function (query) {
        this.variable.query = query;
        return this;
    };
    return OptionsVariableBuilder;
}(VariableBuilder));
export { OptionsVariableBuilder };
//# sourceMappingURL=optionsVariableBuilder.js.map