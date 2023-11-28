import { from, map, of } from 'rxjs';
import { CustomVariableSupport } from '@grafana/data';
import { getTimeSrv } from '../../../features/dashboard/services/TimeSrv';
import { VariableQueryEditor } from './VariableQueryEditor';
export class VariableSupport extends CustomVariableSupport {
    constructor(dataAPI, timeSrv = getTimeSrv()) {
        super();
        this.dataAPI = dataAPI;
        this.timeSrv = timeSrv;
        this.editor = VariableQueryEditor;
    }
    query(request) {
        if (request.targets[0].type === 'profileType') {
            return from(this.dataAPI.getProfileTypes()).pipe(map((values) => {
                return { data: values.map((v) => ({ text: v.label, value: v.id })) };
            }));
        }
        if (request.targets[0].type === 'label') {
            if (!request.targets[0].profileTypeId) {
                return of({ data: [] });
            }
            return from(this.dataAPI.getLabelNames(request.targets[0].profileTypeId + '{}', this.timeSrv.timeRange().from.valueOf(), this.timeSrv.timeRange().to.valueOf())).pipe(map((values) => {
                return { data: values.map((v) => ({ text: v })) };
            }));
        }
        if (request.targets[0].type === 'labelValue') {
            if (!request.targets[0].labelName || !request.targets[0].profileTypeId) {
                return of({ data: [] });
            }
            return from(this.dataAPI.getLabelValues(request.targets[0].profileTypeId + '{}', request.targets[0].labelName, this.timeSrv.timeRange().from.valueOf(), this.timeSrv.timeRange().to.valueOf())).pipe(map((values) => {
                return { data: values.map((v) => ({ text: v })) };
            }));
        }
        return of({ data: [] });
    }
}
//# sourceMappingURL=VariableSupport.js.map