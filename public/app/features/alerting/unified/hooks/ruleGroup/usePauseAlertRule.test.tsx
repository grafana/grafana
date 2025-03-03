import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { render } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockCombinedRule, mockCombinedRuleGroup, mockGrafanaRulerRule } from '../../mocks';
import { grafanaRulerGroupName, grafanaRulerNamespace, grafanaRulerRule } from '../../mocks/grafanaRulerApi';
import { setUpdateRulerRuleNamespaceHandler } from '../../mocks/server/configure';
import { captureRequests, serializeRequests } from '../../mocks/server/events';
import { groupIdentifier } from '../../utils/groupIdentifier';
import { SerializeState } from '../useAsync';

import { usePauseRuleInGroup } from './usePauseAlertRule';

setupMswServer();

beforeAll(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleRead]);
});

describe('pause rule', () => {
  it('should be able to pause a rule', async () => {
    const capture = captureRequests();
    setUpdateRulerRuleNamespaceHandler({ delay: 0 });

    render(<PauseTestComponent />);
    expect(byText(/uninitialized/i).get()).toBeInTheDocument();

    await userEvent.click(byRole('button').get());
    expect(await byText(/loading/i).find()).toBeInTheDocument();

    expect(await byText(/success/i).find()).toBeInTheDocument();
    expect(await byText(/result/i).find()).toBeInTheDocument();
    expect(byText(/error/i).query()).not.toBeInTheDocument();

    const requests = await capture;
    const [get, update, ...rest] = await serializeRequests(requests);

    expect(update.body).toHaveProperty('rules[0].grafana_alert.is_paused', true);
    expect([get, update, ...rest]).toMatchSnapshot();
  });

  it('should throw if the rule is not found in the group', async () => {
    setUpdateRulerRuleNamespaceHandler();
    render(
      <PauseTestComponent
        rulerRule={mockGrafanaRulerRule({ uid: 'does-not-exist', namespace_uid: grafanaRulerNamespace.uid })}
      />
    );
    expect(byText(/uninitialized/i).get()).toBeInTheDocument();

    await userEvent.click(byRole('button').get());
    expect(await byText(/error: no rule matching identifier/i).find()).toBeInTheDocument();
  });

  it('should be able to handle error', async () => {
    setUpdateRulerRuleNamespaceHandler({
      delay: 0,
      response: new HttpResponse('oops', { status: 500 }),
    });

    render(<PauseTestComponent />);

    expect(await byText(/uninitialized/i).find()).toBeInTheDocument();

    await userEvent.click(byRole('button').get());
    expect(await byText(/loading/i).find()).toBeInTheDocument();
    expect(byText(/success/i).query()).not.toBeInTheDocument();
    expect(await byText(/error: oops/i).find()).toBeInTheDocument();
  });
});

// this test component will cycle through the loading states
const PauseTestComponent = (options: { rulerRule?: RulerGrafanaRuleDTO }) => {
  const [pauseRule, requestState] = usePauseRuleInGroup();

  const rulerRule = options.rulerRule ?? grafanaRulerRule;
  const rule = mockCombinedRule({
    rulerRule,
    group: mockCombinedRuleGroup(grafanaRulerGroupName, []),
  });
  const ruleGroupID = groupIdentifier.fromCombinedRule(rule);

  const onClick = () => {
    if (ruleGroupID.groupOrigin !== 'grafana') {
      throw new Error('not a Grafana rule');
    }

    // always handle your errors!
    pauseRule.execute(ruleGroupID, rulerRule.grafana_alert.uid, true).catch(() => {});
  };

  return (
    <>
      <button onClick={() => onClick()} />
      <SerializeState state={requestState} />
    </>
  );
};
