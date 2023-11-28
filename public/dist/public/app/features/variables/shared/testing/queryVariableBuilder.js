import { DatasourceVariableBuilder } from './datasourceVariableBuilder';
export class QueryVariableBuilder extends DatasourceVariableBuilder {
    withDatasource(datasource) {
        this.variable.datasource = datasource;
        return this;
    }
}
//# sourceMappingURL=queryVariableBuilder.js.map