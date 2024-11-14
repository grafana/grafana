import { CoreApp, DataQueryRequest, getDefaultTimeRange } from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';

export class MockQuery implements DataQuery {
  refId: string;
  testQuery: string;
  datasource?: DataSourceRef;

  constructor(refId = 'A', testQuery = '', datasourceRef?: DataSourceRef) {
    this.refId = refId;
    this.testQuery = testQuery;
    this.datasource = datasourceRef;
  }
}

export class MockDataQueryRequest implements DataQueryRequest<MockQuery> {
  app = CoreApp.Unknown;
  interval = '';
  intervalMs = 0;
  range = getDefaultTimeRange();
  requestId = '1';
  scopedVars = {};
  startTime = 0;
  targets: MockQuery[];
  timezone = 'utc';

  constructor({ targets }: { targets: MockQuery[] }) {
    this.targets = targets || [];
  }
}
