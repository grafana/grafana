import { CoreApp, getDefaultTimeRange } from '@grafana/data';
export class MockQuery {
    constructor(refId = 'A', testQuery = '', datasourceRef) {
        this.refId = refId;
        this.testQuery = testQuery;
        this.datasource = datasourceRef;
    }
}
export class MockDataQueryRequest {
    constructor({ targets }) {
        this.app = CoreApp.Unknown;
        this.interval = '';
        this.intervalMs = 0;
        this.range = getDefaultTimeRange();
        this.requestId = '1';
        this.scopedVars = {};
        this.startTime = 0;
        this.timezone = 'utc';
        this.targets = targets || [];
    }
}
//# sourceMappingURL=query.js.map