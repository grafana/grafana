import { HttpResponse } from 'msw';
import { render, userEvent } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { AccessControlAction } from 'app/types';
import { CombinedRule, RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../mockApi';
import {
  grantUserPermissions,
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockGrafanaRulerRule,
  mockRulerAlertingRule,
  mockRulerRecordingRule,
  mockRulerRuleGroup,
} from '../mocks';
import { grafanaRulerGroupName, grafanaRulerNamespace, grafanaRulerRule } from '../mocks/grafanaRulerApi';
import { GROUP_1, NAMESPACE_1, NAMESPACE_2, namespace2 } from '../mocks/mimirRulerApi';
import {
  mimirDataSource,
  setRulerRuleGroupHandler,
  setUpdateRulerRuleNamespaceHandler,
} from '../mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from '../mocks/server/constants';
import { captureRequests, serializeRequests } from '../mocks/server/events';
import { rulerRuleGroupHandler, updateRulerRuleNamespaceHandler } from '../mocks/server/handlers/grafanaRuler';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { stringifyErrorLike } from '../utils/misc';
import { getRuleGroupLocationFromCombinedRule } from '../utils/rules';

import { AsyncState, isError, isLoading, isSuccess, isUninitialized } from './useAsync';
import {
  useDeleteRuleFromGroup,
  useMoveRuleGroup,
  usePauseRuleInGroup,
  useRenameRuleGroup,
  useUpdateRuleGroupConfiguration,
} from './useProduceNewRuleGroup';

const server = setupMswServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
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
    expect(await byText(/error: No rule with UID/i).find()).toBeInTheDocument();
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

    render(<DeleteTestComponent rule={rules[1]} />);

    await userEvent.click(byRole('button').get());

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

    render(<DeleteTestComponent rule={rules[1]} />);

    await userEvent.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should delete the entire group if no more rules are left', async () => {
    const capture = captureRequests();

    const combined = mockCombinedRule({
      rulerRule: grafanaRulerRule,
    });

    render(<DeleteTestComponent rule={combined} />);
    await userEvent.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });
});

describe('useUpdateRuleGroupConfiguration', () => {
  it('should update a rule group interval', async () => {
    const capture = captureRequests();

    render(<UpdateRuleGroupComponent />);
    await userEvent.click(byRole('button').get());
    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should rename a rule group', async () => {
    const capture = captureRequests();

    render(<RenameRuleGroupComponent />);
    await userEvent.click(byRole('button').get());
    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should not be able to move a Grafana managed rule group', async () => {
    render(<MoveGrafanaManagedRuleGroupComponent />);
    await userEvent.click(byRole('button').get());
    expect(await byText(/error:.+not supported.+/i).find()).toBeInTheDocument();
  });

  it('should be able to move a Data Source managed rule group', async () => {
    mimirDataSource();
    const capture = captureRequests();

    render(<MoveDataSourceManagedRuleGroupComponent namespace={NAMESPACE_2} group={'a-new-group'} interval={'2m'} />);
    await userEvent.click(byRole('button').get());
    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should not move a Data Source managed rule group to namespace with existing target group name', async () => {
    mimirDataSource();

    render(
      <MoveDataSourceManagedRuleGroupComponent namespace={NAMESPACE_2} group={namespace2[0].name} interval={'2m'} />
    );
    await userEvent.click(byRole('button').get());
    expect(await byText(/error:.+not supported.+/i).find()).toBeInTheDocument();
  });
});

const UpdateRuleGroupComponent = () => {
  const [requestState, updateRuleGroup] = useUpdateRuleGroupConfiguration();

  const ruleGroupID: RuleGroupIdentifier = {
    dataSourceName: GRAFANA_RULES_SOURCE_NAME,
    groupName: grafanaRulerGroupName,
    namespaceName: grafanaRulerNamespace.uid,
  };

  return (
    <>
      <button onClick={() => updateRuleGroup.execute(ruleGroupID, '2m')} />
      <SerializeState state={requestState} />
    </>
  );
};

const RenameRuleGroupComponent = () => {
  const [requestState, renameRuleGroup] = useRenameRuleGroup();

  const ruleGroupID: RuleGroupIdentifier = {
    dataSourceName: GRAFANA_RULES_SOURCE_NAME,
    groupName: grafanaRulerGroupName,
    namespaceName: grafanaRulerNamespace.uid,
  };

  return (
    <>
      <button onClick={() => renameRuleGroup.execute(ruleGroupID, 'another-group-name', '2m')} />
      <SerializeState state={requestState} />
    </>
  );
};

const MoveGrafanaManagedRuleGroupComponent = () => {
  const [requestState, moveRuleGroup] = useMoveRuleGroup();

  const ruleGroupID: RuleGroupIdentifier = {
    dataSourceName: GRAFANA_RULES_SOURCE_NAME,
    groupName: grafanaRulerGroupName,
    namespaceName: grafanaRulerNamespace.uid,
  };

  return (
    <>
      <button onClick={() => moveRuleGroup.execute(ruleGroupID, 'another-namespace', 'another-group-name', '2m')} />
      <SerializeState state={requestState} />
    </>
  );
};

function SerializeState({ state }: { state: AsyncState<unknown> }) {
  return (
    <>
      {isUninitialized(state) && 'uninitialized'}
      {isLoading(state) && 'loading'}
      {isSuccess(state) && 'success'}
      {isSuccess(state) && `result: ${JSON.stringify(state.result, null, 2)}`}
      {isError(state) && `error: ${stringifyErrorLike(state.error)}`}
    </>
  );
}

type MoveDataSourceManagedRuleGroupComponentProps = {
  namespace: string;
  group: string;
  interval: string;
};

const MoveDataSourceManagedRuleGroupComponent = ({
  namespace,
  group,
  interval,
}: MoveDataSourceManagedRuleGroupComponentProps) => {
  const [requestState, moveRuleGroup] = useMoveRuleGroup();

  const ruleGroupID: RuleGroupIdentifier = {
    dataSourceName: MIMIR_DATASOURCE_UID,
    groupName: GROUP_1,
    namespaceName: NAMESPACE_1,
  };

  return (
    <>
      <button onClick={() => moveRuleGroup.execute(ruleGroupID, namespace, group, interval)} />
      <SerializeState state={requestState} />
    </>
  );
};

// this test component will cycle through the loading states
const PauseTestComponent = (options: { rulerRule?: RulerGrafanaRuleDTO }) => {
  const [requestState, pauseRule] = usePauseRuleInGroup();

  const rulerRule = options.rulerRule ?? grafanaRulerRule;
  const rule = mockCombinedRule({
    rulerRule,
    group: mockCombinedRuleGroup(grafanaRulerGroupName, []),
  });
  const ruleGroupID = getRuleGroupLocationFromCombinedRule(rule);

  const onClick = () => {
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

type DeleteTestComponentProps = {
  rule: CombinedRule;
};
const DeleteTestComponent = ({ rule }: DeleteTestComponentProps) => {
  const [requestState, deleteRuleFromGroup] = useDeleteRuleFromGroup();

  // always handle your errors!
  const ruleGroupID = getRuleGroupLocationFromCombinedRule(rule);
  const onClick = () => {
    deleteRuleFromGroup.execute(ruleGroupID, rule.rulerRule!);
  };

  return (
    <>
      <button onClick={() => onClick()} />
      <SerializeState state={requestState} />
    </>
  );
};
