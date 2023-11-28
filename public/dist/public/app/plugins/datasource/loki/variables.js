import { __awaiter } from "tslib";
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomVariableSupport } from '@grafana/data';
import { LokiVariableQueryEditor } from './components/VariableQueryEditor';
export class LokiVariableSupport extends CustomVariableSupport {
    constructor(datasource) {
        super();
        this.datasource = datasource;
        this.editor = LokiVariableQueryEditor;
    }
    execute(query, scopedVars) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.datasource.metricFindQuery(query, { scopedVars });
        });
    }
    query(request) {
        const result = this.execute(request.targets[0], request.scopedVars);
        return from(result).pipe(map((data) => ({ data })));
    }
}
//# sourceMappingURL=variables.js.map