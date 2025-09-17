import { HttpResponse } from 'msw';
import { render } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import server from '@grafana/test-utils/server';
import { AccessControlAction } from 'app/types/accessControl';
import { CombinedRule } from 'app/types/unified-alerting';

import { setupMswServer } from '../../mockApi';
import {
  grantUserPermissions,
  mockCombinedRule,
  mockGrafanaRulerRule,
  mockRulerAlertingRule,
  mockRulerRecordingRule,
  mockRulerRuleGroup,
} from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';
import { setRulerRuleGroupHandler, setUpdateRulerRuleNamespaceHandler } from '../../mocks/server/configure';
import { captureRequests, serializeRequests } from '../../mocks/server/events';
import { rulerRuleGroupHandler, updateRulerRuleNamespaceHandler } from '../../mocks/server/handlers/mimirRuler';
import { fromRulerRuleAndRuleGroupIdentifier } from '../../utils/rule-id';
import { getRuleGroupLocationFromCombinedRule } from '../../utils/rules';
import { SerializeState } from '../useAsync';

import { useDeleteRuleFromGroup } from './useDeleteRuleFromGroup';

setupMswServer();

beforeAll(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleRead]);
});

describe('delete rule', () => {
  it('should be able to delete a Grafana managed rule', async () => {
    const rules = [
      mockCombinedRule({
        name: 'r1',
        rulerRule: mockGrafanaRulerRule({ uid: 'r1' }),
      }),
      mockCombinedRule({
        name: 'r2',
        rulerRule: mockGrafanaRulerRule({ uid: 'r2' }),
      }),
    ];
    const group = mockRulerRuleGroup({
      name: 'group-1',
      rules: [rules[0].rulerRule!, rules[1].rulerRule!],
    });

    const getGroup = rulerRuleGroupHandler({
      delay: 0,
      response: HttpResponse.json(group),
    });

    const updateNamespace = updateRulerRuleNamespaceHandler({
      response: new HttpResponse(undefined, { status: 200 }),
    });

    server.use(getGroup, updateNamespace);

    const capture = captureRequests();

    const { user } = render(<DeleteTestComponent rule={rules[1]} />);

    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should be able to delete a Data source managed rule', async () => {
    setUpdateRulerRuleNamespaceHandler({
      response: new HttpResponse(undefined, { status: 200 }),
    });

    const rules = [
      mockCombinedRule({
        name: 'r1',
        rulerRule: mockRulerAlertingRule({ alert: 'r1', labels: { foo: 'bar' } }),
      }),
      mockCombinedRule({
        name: 'r2',
        rulerRule: mockRulerRecordingRule({ record: 'r2', labels: { bar: 'baz' } }),
      }),
    ];

    const group = mockRulerRuleGroup({
      name: 'group-1',
      rules: [rules[0].rulerRule!, rules[1].rulerRule!],
    });

    setRulerRuleGroupHandler({
      delay: 0,
      response: HttpResponse.json(group),
    });

    const capture = captureRequests();

    const { user } = render(<DeleteTestComponent rule={rules[1]} />);

    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should delete the entire group if no more rules are left', async () => {
    const rule = mockCombinedRule({
      rulerRule: grafanaRulerRule,
    });

    const group = mockRulerRuleGroup({
      name: 'group-1',
      rules: [rule.rulerRule!],
    });

    setRulerRuleGroupHandler({
      response: HttpResponse.json(group),
    });

    const capture = captureRequests();

    const { user } = render(<DeleteTestComponent rule={rule} />);
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });
});

type DeleteTestComponentProps = {
  rule: CombinedRule;
};
const DeleteTestComponent = ({ rule }: DeleteTestComponentProps) => {
  const [deleteRuleFromGroup, requestState] = useDeleteRuleFromGroup();

  // always handle your errors!
  const ruleGroupID = getRuleGroupLocationFromCombinedRule(rule);
  const ruleID = fromRulerRuleAndRuleGroupIdentifier(ruleGroupID, rule.rulerRule!);
  const onClick = () => {
    deleteRuleFromGroup.execute(ruleGroupID, ruleID);
  };

  return (
    <>
      <button onClick={() => onClick()} />
      <SerializeState state={requestState} />
    </>
  );
};
