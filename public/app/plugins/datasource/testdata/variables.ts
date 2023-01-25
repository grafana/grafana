import { StandardVariableQuery, StandardVariableSupport } from '@grafana/data';

import { TestData } from './dataquery.gen';
import { TestDataDataSource } from './datasource';

export class TestDataVariableSupport extends StandardVariableSupport<TestDataDataSource> {
  toDataQuery(query: StandardVariableQuery): TestData {
    return {
      refId: 'TestDataDataSource-QueryVariable',
      stringInput: query.query,
      scenarioId: 'variables-query',
      csvWave: undefined,
    };
  }
}
