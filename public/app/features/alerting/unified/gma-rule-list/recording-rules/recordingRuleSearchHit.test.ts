import { toRecordingRuleSearchHit } from './recordingRuleSearchHit';

function toHit(fields: Record<string, unknown>) {
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
  it.each([
    { health: 'Recording', expected: 'Recording' },
    { health: 'Error', expected: 'Error' },
    { health: 'OK', expected: undefined },
    { health: 'recording', expected: undefined },
  ])('reads health $health as $expected', ({ health, expected }) => {
    expect(toHit({ health }).health).toBe(expected);
  });
});
