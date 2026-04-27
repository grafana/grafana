import { type StandardVariableQuery, StandardVariableSupport } from '@grafana/data/types';

import { type TestDataDataQuery, TestDataQueryType } from './dataquery';
import { type TestDataDataSource } from './datasource';

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
