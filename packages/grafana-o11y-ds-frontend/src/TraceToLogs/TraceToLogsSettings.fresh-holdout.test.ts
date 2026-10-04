import { getTraceToLogsOptions, type TraceToLogsData } from './TraceToLogsSettings';

describe('ORQELON Grafana #133397 fresh holdout', () => {
  it('preserves a legacy query and enables customQuery when the legacy flag is absent', () => {
    const data = {
      tracesToLogs: {
        datasourceUid: 'splunk_fresh_uid',
        query: 'source=payments trace="$traceId"',
        filterBySpanID: true,
      },
    } as unknown as TraceToLogsData;

    expect(getTraceToLogsOptions(data)).toMatchObject({
      datasourceUid: 'splunk_fresh_uid',
      query: 'source=payments trace="$traceId"',
      customQuery: true,
      filterBySpanID: true,
    });
  });
});
