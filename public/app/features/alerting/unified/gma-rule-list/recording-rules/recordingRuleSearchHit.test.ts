import { toRecordingRuleSearchHit } from './recordingRuleSearchHit';

function toHit(fields?: Record<string, unknown>) {
  return toRecordingRuleSearchHit({
    resource: {
      group: 'rules.alerting.grafana.app',
      kind: 'RecordingRule',
      resource: 'recordingrules',
      name: 'rule-1',
    },
    fields,
  });
}

describe('toRecordingRuleSearchHit', () => {
  it('reads the row fields from the search hit', () => {
    const hit = toHit({ title: 'cpu:usage:rate5m', folder: 'folder-1', paused: true, health: 'Recording' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'cpu:usage:rate5m',
      folderUid: 'folder-1',
      paused: true,
      health: 'Recording',
    });
  });

  it('falls back to the rule UID for the title and leaves fields of the wrong type unset', () => {
    const hit = toHit({ title: 42, folder: ['folder-1'], paused: 'true' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'rule-1',
      folderUid: undefined,
      paused: undefined,
      health: undefined,
    });
  });

  it('leaves status unset when the search returned no fields', () => {
    expect(toHit()).toEqual({ uid: 'rule-1', title: 'rule-1' });
  });

  it.each([
    { name: 'wrong case', health: 'recording' },
    { name: 'an unknown value', health: 'Degraded' },
    { name: 'an Alert rule health value', health: 'OK' },
  ])('leaves health unset for $name', ({ health }) => {
    expect(toHit({ health }).health).toBeUndefined();
  });
});
