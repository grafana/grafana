import { DataSourceApi, } from '@grafana/data';
/**
 * This should not really be called
 */
export class DashboardDatasource extends DataSourceApi {
    constructor(instanceSettings) {
        super(instanceSettings);
    }
    getCollapsedText(query) {
        return `Dashboard Reference: ${query.panelId}`;
    }
    query(options) {
        return Promise.reject('This should not be called directly');
    }
    testDatasource() {
        return Promise.resolve({ message: '', status: '' });
    }
}
//# sourceMappingURL=datasource.js.map