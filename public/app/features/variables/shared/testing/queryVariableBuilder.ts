import { QueryVariableModel } from 'app/features/variables/types';
import { DatasourceVariableBuilder } from './datasourceVariableBuilder';

export class QueryVariableBuilder<T extends QueryVariableModel> extends DatasourceVariableBuilder<T> {
  withTags(useTags: boolean) {
    this.variable.useTags = useTags;
    return this;
  }

  withTagsQuery(tagsQuery: string) {
    this.variable.tagsQuery = tagsQuery;
    return this;
  }

  withDatasource(datasource: string) {
    this.variable.datasource = datasource;
    return this;
  }
}
