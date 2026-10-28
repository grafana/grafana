import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

describe('buildRecordingRuleSearchQuery', () => {
  it('asks for the first 40 rules by title with the fields the row shows, without a state field', () => {
    expect(buildRecordingRuleSearchQuery()).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      sort: [{ field: 'title', direction: 'asc' }],
      fields: [
        'title',
        'folder',
        'paused',
        'health',
        'lastError',
        'interval',
        'labels',
        'datasourceUIDs',
        'metric',
        'targetDatasourceUID',
      ],
      limit: 40,
    });
  });

  it('passes the continuation token through', () => {
    expect(buildRecordingRuleSearchQuery('opaque-token').continue).toBe('opaque-token');
  });
});
