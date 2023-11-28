import { from } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { CustomVariableSupport } from '@grafana/data';
import CloudMonitoringMetricFindQuery from './CloudMonitoringMetricFindQuery';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';
export class CloudMonitoringVariableSupport extends CustomVariableSupport {
    constructor(datasource) {
        super();
        this.datasource = datasource;
        this.editor = CloudMonitoringVariableQueryEditor;
        this.metricFindQuery = new CloudMonitoringMetricFindQuery(datasource);
    }
    query(request) {
        const executeObservable = from(this.metricFindQuery.execute(request.targets[0]));
        return from(this.datasource.ensureGCEDefaultProject()).pipe(mergeMap(() => executeObservable), map((data) => ({ data })));
    }
}
//# sourceMappingURL=variables.js.map