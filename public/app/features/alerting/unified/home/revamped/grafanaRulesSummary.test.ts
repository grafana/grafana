import { type GrafanaPromRecordingRuleDTO } from 'app/types/unified-alerting-dto';

import { mockGrafanaPromAlertingRule, mockGrafanaPromRuleGroup, mockPromRecordingRule } from '../../mocks';

import { summarizeGrafanaRules } from './grafanaRulesSummary';

function recordingRule(partial: Partial<GrafanaPromRecordingRuleDTO> = {}): GrafanaPromRecordingRuleDTO {
  return { ...mockPromRecordingRule(), uid: 'recording-uid', folderUid: 'folder', isPaused: false, ...partial };
}

describe('summarizeGrafanaRules', () => {
  it('sums alert instance totals across every alerting rule, mapping inactive to normal', () => {
    const groups = [
      mockGrafanaPromRuleGroup({
        rules: [
          mockGrafanaPromAlertingRule({
            uid: 'a',
            totals: { alerting: 3, pending: 1, inactive: 10, nodata: 2 },
          }),
          mockGrafanaPromAlertingRule({ uid: 'b', totals: { alerting: 1, recovering: 4, error: 5 } }),
        ],
      }),
      mockGrafanaPromRuleGroup({ name: 'second', rules: [mockGrafanaPromAlertingRule({ uid: 'c', totals: {} })] }),
    ];

    expect(summarizeGrafanaRules(groups, false).instances).toEqual({
      firing: 4,
      pending: 1,
      recovering: 4,
      noData: 2,
      error: 5,
      normal: 10,
    });
  });

  it('counts the "normal" totals the Grafana rules API returns as normal instances', () => {
    // The shared totals type names the state "inactive", as Prometheus does; Grafana's API sends "normal".
    const fromGrafanaApi: Record<string, number> = { normal: 63, alerting: 2 };
    const groups = [
      mockGrafanaPromRuleGroup({ rules: [mockGrafanaPromAlertingRule({ uid: 'a', totals: fromGrafanaApi })] }),
    ];

    expect(summarizeGrafanaRules(groups, false).instances).toMatchObject({ normal: 63, firing: 2 });
  });

  it('counts paused rules, rules whose health is error, and active rules as the unpaused remainder', () => {
    const groups = [
      mockGrafanaPromRuleGroup({
        rules: [
          mockGrafanaPromAlertingRule({ uid: 'a', isPaused: true }),
          mockGrafanaPromAlertingRule({ uid: 'b', health: 'error' }),
          mockGrafanaPromAlertingRule({ uid: 'c', health: 'ok' }),
          recordingRule({ isPaused: true }),
        ],
      }),
    ];

    const summary = summarizeGrafanaRules(groups, false);

    expect(summary).toMatchObject({ totalRules: 4, pausedRules: 2, activeRules: 2, failingRules: 1 });
  });

  it('skips recording rules when summing instances, since they have no alert instances', () => {
    const recording = recordingRule();
    // A recording rule carrying totals would be a backend bug; make sure it would not be counted.
    Object.assign(recording, { totals: { alerting: 100 } });

    const summary = summarizeGrafanaRules([mockGrafanaPromRuleGroup({ rules: [recording] })], false);

    expect(summary.instances.firing).toBe(0);
    expect(summary.topFiringRules).toEqual([]);
  });

  it('lists the five rules with the most firing instances, most first, leaving out rules with none', () => {
    const firing = [4, 9, 1, 7, 3, 8].map((count, index) =>
      mockGrafanaPromAlertingRule({ uid: `rule-${index}`, name: `Rule ${index}`, totals: { alerting: count } })
    );
    const quiet = mockGrafanaPromAlertingRule({ uid: 'quiet', name: 'Quiet', totals: { inactive: 2 } });

    const summary = summarizeGrafanaRules([mockGrafanaPromRuleGroup({ rules: [...firing, quiet] })], false);

    expect(summary.topFiringRules).toEqual([
      { uid: 'rule-1', name: 'Rule 1', firing: 9 },
      { uid: 'rule-5', name: 'Rule 5', firing: 8 },
      { uid: 'rule-3', name: 'Rule 3', firing: 7 },
      { uid: 'rule-0', name: 'Rule 0', firing: 4 },
      { uid: 'rule-4', name: 'Rule 4', firing: 3 },
    ]);
  });

  it.each([
    { hasMore: true, capped: true },
    { hasMore: false, capped: false },
  ])('reports capped=$capped when the API says more rules exist: $hasMore', ({ hasMore, capped }) => {
    expect(summarizeGrafanaRules([], hasMore).capped).toBe(capped);
  });
});
