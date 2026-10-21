import { toAlertRuleSearchHit } from './alertRuleSearchHit';

function toHit(fields?: Record<string, unknown>) {
  return toAlertRuleSearchHit({
    resource: { group: 'rules.alerting.grafana.app', kind: 'AlertRule', resource: 'alertrules', name: 'rule-1' },
    fields,
  });
}

describe('toAlertRuleSearchHit', () => {
  it('reads the row fields from the search hit', () => {
    const hit = toHit({ title: 'CPU high', folder: 'folder-1', paused: true, state: 'Firing', health: 'OK' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'CPU high',
      folderUid: 'folder-1',
      paused: true,
      state: 'Firing',
      health: 'OK',
    });
  });

  it('falls back to the rule UID for the title and leaves fields of the wrong type unset', () => {
    const hit = toHit({ title: 42, folder: ['folder-1'], paused: 'true', state: null });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'rule-1',
      folderUid: undefined,
      paused: undefined,
      state: undefined,
      health: undefined,
    });
  });

  it('leaves status unset when the search returned no fields', () => {
    expect(toHit()).toEqual({ uid: 'rule-1', title: 'rule-1' });
  });

  it.each([
    { name: 'another case', state: 'FIRING', health: 'ok' },
    { name: 'an unknown value', state: 'Mystery', health: 'Degraded' },
    { name: 'the Recording rule health', state: 'Firing', health: 'Recording' },
  ])('leaves state or health unset for $name', ({ state, health }) => {
    const hit = toHit({ state, health });

    expect(hit.health).toBeUndefined();
    expect(hit.state).toBe(state === 'Firing' ? 'Firing' : undefined);
  });
});
