import { __awaiter } from "tslib";
import { from, of } from 'rxjs';
import { DataSourceApi, toDataFrame, } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { GRAFANA_DATASOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { GrafanaQueryType } from '../../../../plugins/datasource/grafana/types';
export const PUBLIC_DATASOURCE = '-- Public --';
export class PublicAnnotationsDataSource extends DataSourceApi {
    constructor() {
        let meta = {};
        super({
            name: 'public-ds',
            id: 0,
            type: 'public-ds',
            meta,
            uid: PUBLIC_DATASOURCE,
            jsonData: {},
            access: 'proxy',
            readOnly: true,
        });
        this.annotations = {
            prepareQuery(anno) {
                return Object.assign(Object.assign({}, anno), { queryType: GrafanaQueryType.Annotations, refId: 'anno' });
            },
        };
    }
    /**
     * Ideally final -- any other implementation may not work as expected
     */
    query(request) {
        var _a;
        // Return early if no queries exist
        if (!request.targets.length) {
            return of({ data: [] });
        }
        // Currently, annotations requests come in one at a time, so there will only be one target
        const target = request.targets[0];
        if (((_a = target === null || target === void 0 ? void 0 : target.datasource) === null || _a === void 0 ? void 0 : _a.uid) === GRAFANA_DATASOURCE_NAME) {
            return from(this.getAnnotations(request));
        }
        return of({ data: [] });
    }
    getAnnotations(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const { range: { to, from }, } = request;
            const params = {
                from: from.valueOf(),
                to: to.valueOf(),
            };
            const annotations = yield getBackendSrv().get(`/api/public/dashboards/${config.publicDashboardAccessToken}/annotations`, params);
            return { data: [toDataFrame(annotations)] };
        });
    }
    testDatasource() {
        return Promise.resolve({ message: '', status: '' });
    }
}
//# sourceMappingURL=PublicAnnotationsDataSource.js.map