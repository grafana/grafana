import { VariableBuilder } from './variableBuilder';
export class AdHocVariableBuilder extends VariableBuilder {
    withDatasource(datasource) {
        this.variable.datasource = datasource;
        return this;
    }
    withFilters(filters) {
        this.variable.filters = filters;
        return this;
    }
}
//# sourceMappingURL=adHocVariableBuilder.js.map