import { StandardVariableQuery, StandardVariableSupport } from '@grafana/data';

import { TestData, TestDataQueryType } from './dataquery.gen';
import { TestDataDataSource } from './datasource';

export class TestDataVariableSupport extends StandardVariableSupport<TestDataDataSource> {
  toDataQuery(query: StandardVariableQuery): TestData {
    return {
      refId: 'TestDataDataSource-QueryVariable',
      stringInput: query.query,
      scenarioId: TestDataQueryType.VariablesQuery,
      csvWave: undefined,
    };
  }
}
