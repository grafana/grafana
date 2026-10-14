import { toAlertRuleSearchHit } from './alertRuleSearchHit';

function toHit(fields: Record<string, unknown>) {
  return toAlertRuleSearchHit({ resource: { name: 'rule-1' }, fields });
}

describe('toAlertRuleSearchHit', () => {
  it('ALERT-10: reads every returned instance total, keeping a returned zero', () => {
    const hit = toHit({
      totalsHealthy: 4,
      totalsFiring: 0,
      totalsPending: 2,
      totalsRecovering: 1,
      totalsNoData: 3,
      totalsError: 5,
    });

    expect(hit.totals).toEqual({ healthy: 4, firing: 0, pending: 2, recovering: 1, noData: 3, error: 5 });
  });

  it('ALERT-10: leaves a total undefined, never zero, when the search did not return it', () => {
    const hit = toHit({ totalsFiring: 2, totalsPending: 'many' });

    expect(hit.totals).toEqual({
      healthy: undefined,
      firing: 2,
      pending: undefined,
      recovering: undefined,
      noData: undefined,
      error: undefined,
    });
  });
});
