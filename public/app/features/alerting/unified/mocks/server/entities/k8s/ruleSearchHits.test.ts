import {
  alertRuleHitFactory,
  filterRuleSearchHits,
  recordingRuleHitFactory,
  sortRuleSearchHits,
} from './ruleSearchHits';

describe('filterRuleSearchHits', () => {
  it('matches q as a case-insensitive substring of the title', () => {
    const hits = [
      alertRuleHitFactory.build({ title: 'CPU usage high' }),
      alertRuleHitFactory.build({ title: 'Disk space low' }),
    ];

    expect(filterRuleSearchHits(hits, { q: 'cpu' })).toHaveLength(1);
    expect(filterRuleSearchHits(hits, { q: 'CPU' })).toHaveLength(1);
    expect(filterRuleSearchHits(hits, { q: 'nope' })).toHaveLength(0);
  });

  it('matches labels with equals, not-equals, exists and not-exists', () => {
    const hits = [
      alertRuleHitFactory.build({ title: 'has-critical', labels: { severity: 'critical' } }),
      alertRuleHitFactory.build({ title: 'has-warning', labels: { severity: 'warning' } }),
      alertRuleHitFactory.build({ title: 'no-labels', labels: undefined }),
    ];

    expect(filterRuleSearchHits(hits, { labels: ['severity=critical'] }).map((h) => h.title)).toEqual(['has-critical']);
    // A missing label also satisfies `!=` — only an exact match on the value excludes a hit.
    expect(filterRuleSearchHits(hits, { labels: ['severity!=critical'] }).map((h) => h.title)).toEqual([
      'has-warning',
      'no-labels',
    ]);
    expect(filterRuleSearchHits(hits, { labels: ['severity'] }).map((h) => h.title)).toEqual([
      'has-critical',
      'has-warning',
    ]);
    expect(filterRuleSearchHits(hits, { labels: ['!severity'] }).map((h) => h.title)).toEqual(['no-labels']);
  });

  it('ANDs multiple label matchers together', () => {
    const hits = [
      alertRuleHitFactory.build({ title: 'both', labels: { severity: 'critical', team: 'infra' } }),
      alertRuleHitFactory.build({ title: 'severity-only', labels: { severity: 'critical' } }),
    ];

    expect(filterRuleSearchHits(hits, { labels: ['severity=critical', 'team=infra'] }).map((h) => h.title)).toEqual([
      'both',
    ]);
  });

  it('ORs multiple values within groups/folders/names, ANDs across fields', () => {
    const hits = [
      alertRuleHitFactory.build({ title: 'a', name: 'rule-a', folder: 'folder-1', group: 'group-1' }),
      alertRuleHitFactory.build({ title: 'b', name: 'rule-b', folder: 'folder-2', group: 'group-1' }),
      alertRuleHitFactory.build({ title: 'c', name: 'rule-c', folder: 'folder-1', group: 'group-2' }),
    ];

    expect(filterRuleSearchHits(hits, { folders: ['folder-1', 'folder-2'] }).map((h) => h.title)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(filterRuleSearchHits(hits, { folders: ['folder-1'], groups: ['group-1'] }).map((h) => h.title)).toEqual([
      'a',
    ]);
  });

  it('narrows by type', () => {
    const hits = [alertRuleHitFactory.build({ title: 'alert' }), recordingRuleHitFactory.build({ title: 'recording' })];

    expect(filterRuleSearchHits(hits, { type: 'alertrule' }).map((h) => h.title)).toEqual(['alert']);
    expect(filterRuleSearchHits(hits, { type: 'recordingrule' }).map((h) => h.title)).toEqual(['recording']);
  });

  it('matches paused as an exact boolean', () => {
    const hits = [
      alertRuleHitFactory.build({ title: 'paused', paused: true }),
      alertRuleHitFactory.build({ title: 'active', paused: false }),
      alertRuleHitFactory.build({ title: 'unset' }),
    ];

    expect(filterRuleSearchHits(hits, { paused: 'true' }).map((h) => h.title)).toEqual(['paused']);
    expect(filterRuleSearchHits(hits, { paused: 'false' }).map((h) => h.title)).toEqual(['active', 'unset']);
  });

  it('matches alertrule-only fields (dashboardUID, receiver) and ignores them for recording rules', () => {
    const hits = [
      alertRuleHitFactory.build({ title: 'matches', receiver: 'my-receiver' }),
      alertRuleHitFactory.build({ title: 'no-match', receiver: 'other-receiver' }),
      recordingRuleHitFactory.build({ title: 'recording' }),
    ];

    expect(filterRuleSearchHits(hits, { receiver: 'my-receiver' }).map((h) => h.title)).toEqual(['matches']);
  });

  it('matches recordingrule-only fields (metric, targetDatasourceUID) and ignores them for alert rules', () => {
    const hits = [
      recordingRuleHitFactory.build({ title: 'matches', metric: 'my_metric' }),
      recordingRuleHitFactory.build({ title: 'no-match', metric: 'other_metric' }),
      alertRuleHitFactory.build({ title: 'alert' }),
    ];

    expect(filterRuleSearchHits(hits, { metric: 'my_metric' }).map((h) => h.title)).toEqual(['matches']);
  });

  it('matches datasourceUIDs against any of the hit datasource uids', () => {
    const hits = [
      alertRuleHitFactory.build({ title: 'a', datasourceUIDs: ['ds-1', 'ds-2'] }),
      alertRuleHitFactory.build({ title: 'b', datasourceUIDs: ['ds-3'] }),
    ];

    expect(filterRuleSearchHits(hits, { datasourceUIDs: ['ds-2'] }).map((h) => h.title)).toEqual(['a']);
  });
});

describe('sortRuleSearchHits', () => {
  it('sorts by title ascending by default', () => {
    const hits = [alertRuleHitFactory.build({ title: 'Charlie' }), alertRuleHitFactory.build({ title: 'Alpha' })];

    expect(sortRuleSearchHits(hits, undefined).map((h) => h.title)).toEqual(['Alpha', 'Charlie']);
  });

  it('sorts by title descending with -title', () => {
    const hits = [alertRuleHitFactory.build({ title: 'Alpha' }), alertRuleHitFactory.build({ title: 'Charlie' })];

    expect(sortRuleSearchHits(hits, '-title').map((h) => h.title)).toEqual(['Charlie', 'Alpha']);
  });

  it('sorts by folder/group before title with group', () => {
    const hits = [
      alertRuleHitFactory.build({ title: 'z', folder: 'folder-b', group: 'group-1' }),
      alertRuleHitFactory.build({ title: 'a', folder: 'folder-a', group: 'group-1' }),
    ];

    expect(sortRuleSearchHits(hits, 'group').map((h) => h.title)).toEqual(['a', 'z']);
  });
});
