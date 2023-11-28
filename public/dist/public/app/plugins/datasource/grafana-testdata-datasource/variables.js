import { StandardVariableSupport } from '@grafana/data';
import { TestDataQueryType } from './dataquery.gen';
export class TestDataVariableSupport extends StandardVariableSupport {
    toDataQuery(query) {
        return {
            refId: 'TestDataDataSource-QueryVariable',
            stringInput: query.query,
            scenarioId: TestDataQueryType.VariablesQuery,
            csvWave: undefined,
        };
    }
}
//# sourceMappingURL=variables.js.map