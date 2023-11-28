import { __rest } from "tslib";
import { PluginType } from '@grafana/data';
import { ElasticDatasource } from './datasource';
export function createElasticDatasource(settings = {}, templateSrv) {
    const { jsonData } = settings, rest = __rest(settings, ["jsonData"]);
    const instanceSettings = Object.assign({ id: 1, meta: {
            id: 'id',
            name: 'name',
            type: PluginType.datasource,
            module: '',
            baseUrl: '',
            info: {
                author: {
                    name: 'Test',
                },
                description: '',
                links: [],
                logos: {
                    large: '',
                    small: '',
                },
                screenshots: [],
                updated: '',
                version: '',
            },
        }, readOnly: false, name: 'test-elastic', type: 'type', uid: 'uid', access: 'proxy', url: '', jsonData: Object.assign({ timeField: '', timeInterval: '' }, jsonData), database: '[test-]YYYY.MM.DD' }, rest);
    return new ElasticDatasource(instanceSettings, templateSrv);
}
//# sourceMappingURL=mocks.js.map