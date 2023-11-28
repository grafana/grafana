import { OptionsVariableBuilder } from './optionsVariableBuilder';
export class TextBoxVariableBuilder extends OptionsVariableBuilder {
    withOriginalQuery(original) {
        this.variable.originalQuery = original;
        return this;
    }
}
//# sourceMappingURL=textboxVariableBuilder.js.map