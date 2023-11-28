import { MultiVariableBuilder } from './multiVariableBuilder';
export class DatasourceVariableBuilder extends MultiVariableBuilder {
    withRefresh(refresh) {
        this.variable.refresh = refresh;
        return this;
    }
    withRegEx(regex) {
        this.variable.regex = regex;
        return this;
    }
}
//# sourceMappingURL=datasourceVariableBuilder.js.map