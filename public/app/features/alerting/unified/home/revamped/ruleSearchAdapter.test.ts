import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { type AlertRuleSearchHit } from '../../gma-rule-list/alert-rules/alertRuleSearchHit';
import { type RecordingRuleSearchHit } from '../../gma-rule-list/recording-rules/recordingRuleSearchHit';

import { alertHitToRule, hasRuleStatus, recordingHitToRule } from './ruleSearchAdapter';

describe('alertHitToRule', () => {
  it('maps the status and the per-state totals the way the rules API reports them', () => {
    const hit: AlertRuleSearchHit = {
      uid: 'cpu',
      title: 'CPU high',
      folderUid: 'folder-1',
      paused: false,
      state: 'Firing',
      health: 'Error',
      lastError: 'boom',
      labels: { team: 'ops' },
      totalsFiring: 3,
      totalsPending: 1,
      totalsRecovering: 2,
      totalsHealthy: 40,
      totalsNoData: 4,
      totalsError: 5,
    };

    expect(alertHitToRule(hit)).toEqual({
      type: PromRuleType.Alerting,
      uid: 'cpu',
      name: 'CPU high',
      folderUid: 'folder-1',
      isPaused: false,
      state: PromAlertingRuleState.Firing,
      health: 'error',
      lastError: 'boom',
      labels: { team: 'ops' },
      query: '',
      totals: { alerting: 3, pending: 1, recovering: 2, inactive: 40, nodata: 4, error: 5 },
      totalsFiltered: { alerting: 3, pending: 1, recovering: 2, inactive: 40, nodata: 4, error: 5 },
    });
  });

  it.each`
    health       | expected
    ${'OK'}      | ${'ok'}
    ${'NoData'}  | ${'nodata'}
    ${'Error'}   | ${'error'}
    ${'Paused'}  | ${'unknown'}
    ${'Unknown'} | ${'unknown'}
    ${undefined} | ${'unknown'}
  `('reports health $health as $expected', ({ health, expected }) => {
    expect(alertHitToRule({ uid: 'a', title: 'A', health }).health).toBe(expected);
  });

  it('reads a rule without status as not firing, with no instance totals', () => {
    const rule = alertHitToRule({ uid: 'a', title: 'A', paused: true });

    expect(rule).toMatchObject({ isPaused: true, state: PromAlertingRuleState.Unknown, totals: {}, folderUid: '' });
  });
});

describe('recordingHitToRule', () => {
  it('maps a recording rule with its pause and health state', () => {
    const hit: RecordingRuleSearchHit = {
      uid: 'rec',
      title: 'Recorded',
      folderUid: 'f',
      paused: true,
      health: 'Error',
    };

    expect(recordingHitToRule(hit)).toMatchObject({
      type: PromRuleType.Recording,
      uid: 'rec',
      name: 'Recorded',
      folderUid: 'f',
      isPaused: true,
      health: 'error',
    });
  });
});

describe('hasRuleStatus', () => {
  it('is false when no alert rule carries a state, health or totals', () => {
    expect(
      hasRuleStatus([
        { uid: 'a', title: 'A' },
        { uid: 'b', title: 'B', paused: true },
      ])
    ).toBe(false);
  });

  it('is true as soon as one alert rule carries any status', () => {
    expect(
      hasRuleStatus([
        { uid: 'a', title: 'A' },
        { uid: 'b', title: 'B', totalsHealthy: 2 },
      ])
    ).toBe(true);
    expect(hasRuleStatus([{ uid: 'a', title: 'A', health: 'OK' }])).toBe(true);
  });

  it('is true when there are no alert rules to judge by', () => {
    expect(hasRuleStatus([])).toBe(true);
  });
});
