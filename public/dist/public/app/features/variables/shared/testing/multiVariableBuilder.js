import { OptionsVariableBuilder } from './optionsVariableBuilder';
export class MultiVariableBuilder extends OptionsVariableBuilder {
    withMulti(multi = true) {
        this.variable.multi = multi;
        return this;
    }
    withIncludeAll(includeAll = true) {
        this.variable.includeAll = includeAll;
        return this;
    }
    withAllValue(allValue) {
        this.variable.allValue = allValue;
        return this;
    }
}
//# sourceMappingURL=multiVariableBuilder.js.map