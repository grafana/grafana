import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomVariableSupport } from '@grafana/data';
import { TempoVariableQueryEditor } from './VariableQueryEditor';
export class TempoVariableSupport extends CustomVariableSupport {
    constructor(datasource) {
        super();
        this.datasource = datasource;
        this.editor = TempoVariableQueryEditor;
    }
    query(request) {
        if (!this.datasource) {
            throw new Error('Datasource not initialized');
        }
        const result = this.datasource.executeVariableQuery(request.targets[0]);
        return from(result).pipe(map((data) => ({ data })));
    }
}
//# sourceMappingURL=variables.js.map