import { getGrafanaRuleInstanceLabels } from './labels';

describe('getGrafanaRuleInstanceLabels', () => {
  it('adds the rule title and folder title as alertname and grafana_folder', () => {
    expect(getGrafanaRuleInstanceLabels({ title: 'HighCPU', folderTitle: 'Kubernetes' })).toEqual([
      ['alertname', 'HighCPU'],
      ['grafana_folder', 'Kubernetes'],
    ]);
  });

  it('leaves out grafana_folder when the folder is not known', () => {
    expect(getGrafanaRuleInstanceLabels({ title: 'HighCPU' })).toEqual([['alertname', 'HighCPU']]);
  });

  it('adds the rule and folder UIDs when they are given', () => {
    expect(getGrafanaRuleInstanceLabels({ title: 'HighCPU', uid: 'rule-1', folderUid: 'folder-1' })).toEqual([
      ['alertname', 'HighCPU'],
      ['__alert_rule_uid__', 'rule-1'],
      ['__alert_rule_namespace_uid__', 'folder-1'],
    ]);
  });

  it("keeps the rule's own labels, but uses Grafana's value when a rule label has the same name", () => {
    expect(
      getGrafanaRuleInstanceLabels({
        title: 'HighCPU',
        folderTitle: 'Kubernetes',
        labels: { severity: 'critical', alertname: 'something else' },
      })
    ).toEqual([
      ['severity', 'critical'],
      ['alertname', 'HighCPU'],
      ['grafana_folder', 'Kubernetes'],
    ]);
  });
});
