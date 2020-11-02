import { StandardVariableQuery, StandardVariableSupport, VariableSupportType } from '@grafana/data';

import { TestDataDataSource } from './datasource';
import { TestDataQuery } from './types';

export class TestDataVariableSupport implements StandardVariableSupport<TestDataDataSource> {
  type: VariableSupportType = 'standard';

  toDataQuery(query: StandardVariableQuery): TestDataQuery {
    return {
      refId: 'TestDataDataSource-QueryVariable',
      stringInput: query.query,
      scenarioId: 'variables-query',
      csvWave: null,
      points: [],
    };
  }
}
