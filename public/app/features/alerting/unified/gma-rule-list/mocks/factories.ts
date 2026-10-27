import { type RuleKind } from '../shared/ruleKind';

/** One item of a rule search response. */
export function ruleItem(kind: RuleKind, uid: string, title: string, folder: string) {
  return {
    resource: {
      group: 'rules.alerting.grafana.app',
      kind: kind === 'alert' ? 'AlertRule' : 'RecordingRule',
      name: uid,
      resource: kind === 'alert' ? 'alertrules' : 'recordingrules',
    },
    fields: { title, folder },
  };
}
