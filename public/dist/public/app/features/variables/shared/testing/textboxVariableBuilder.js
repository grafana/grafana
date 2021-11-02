import { __extends } from "tslib";
import { OptionsVariableBuilder } from './optionsVariableBuilder';
var TextBoxVariableBuilder = /** @class */ (function (_super) {
    __extends(TextBoxVariableBuilder, _super);
    function TextBoxVariableBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TextBoxVariableBuilder.prototype.withOriginalQuery = function (original) {
        this.variable.originalQuery = original;
        return this;
    };
    return TextBoxVariableBuilder;
}(OptionsVariableBuilder));
export { TextBoxVariableBuilder };
//# sourceMappingURL=textboxVariableBuilder.js.map