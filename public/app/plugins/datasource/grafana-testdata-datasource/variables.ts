import { StandardVariableQuery, StandardVariableSupport } from '@grafana/data';

import { TestDataDataQuery, TestDataQueryType } from './dataquery.gen';
import { TestDataDataSource } from './datasource';

export class TestDataVariableSupport extends StandardVariableSupport<TestDataDataSource> {
  toDataQuery(query: StandardVariableQuery): TestDataDataQuery {
    return {
      refId: 'TestDataDataSource-QueryVariable',
      stringInput: query.query,
      scenarioId: TestDataQueryType.VariablesQuery,
      csvWave: undefined,
    };
  }
}
