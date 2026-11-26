import { render, screen } from 'test/test-utils';

import { useGetAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../mockApi';
import { mockDataQuery, mockReduceExpression, mockThresholdExpression } from '../mocks';
import { echoBodyResolver, setReplaceGrafanaRuleResolver } from '../mocks/server/configure';
import { getAlertRuleHandler, mockK8sAlertRule } from '../mocks/server/handlers/k8s/alertRules.k8s';
import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { RuleFormType } from '../types/rule-form';

import { useUpsertUngroupedGrafanaRule } from './useUpsertUngroupedGrafanaRule';

const server = setupMswServer();

const values = {
  ...getDefaultFormValues(),
  type: RuleFormType.grafana,
  name: 'new title',
  folder: { title: 'folder-uid', uid: 'folder-uid' },
  queries: [mockDataQuery(), mockReduceExpression({ expression: 'A' }), mockThresholdExpression({ expression: 'B' })],
  condition: 'C',
};

function SaveAndShowCachedTitle() {
  const { data } = useGetAlertRuleQuery({ name: 'rule-uid' });
  const save = useUpsertUngroupedGrafanaRule();
  return (
    <>
      <span>{data?.spec.title}</span>
      <button onClick={() => save({ values, existingUid: 'rule-uid' })}>Save</button>
    </>
  );
}

describe('useUpsertUngroupedGrafanaRule', () => {
  it('refreshes rules read through v0alpha1 after a v1beta1 save', async () => {
    server.use(getAlertRuleHandler([mockK8sAlertRule({ uid: 'rule-uid', title: 'old title' })]));
    setReplaceGrafanaRuleResolver(echoBodyResolver);

    const { user } = render(<SaveAndShowCachedTitle />);
    expect(await screen.findByText('old title')).toBeInTheDocument();

    server.use(getAlertRuleHandler([mockK8sAlertRule({ uid: 'rule-uid', title: 'new title' })]));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('new title')).toBeInTheDocument();
  });
});
