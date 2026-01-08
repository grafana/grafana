import { render } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { grafanaRulerGroupName, grafanaRulerGroupName2, grafanaRulerNamespace } from '../../mocks/grafanaRulerApi';
import { GROUP_1, NAMESPACE_1, NAMESPACE_2, namespace2 } from '../../mocks/mimirRulerApi';
import { mimirDataSource } from '../../mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from '../../mocks/server/constants';
import { captureRequests, serializeRequests } from '../../mocks/server/events';
import { SwapOperation } from '../../reducers/ruler/ruleGroups';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { SerializeState } from '../useAsync';

import {
  useMoveRuleGroup,
  useRenameRuleGroup,
  useReorderRuleForRuleGroup,
  useUpdateRuleGroupConfiguration,
} from './useUpdateRuleGroup';

setupMswServer();

beforeAll(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleRead]);
});

describe('useUpdateRuleGroupConfiguration', () => {
  it('should update a rule group interval', async () => {
    const capture = captureRequests();

    const { user } = render(<UpdateRuleGroupComponent />);
    await user.click(byRole('button').get());
    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should rename a rule group', async () => {
    const capture = captureRequests();

    const { user } = render(<RenameRuleGroupComponent />);
    await user.click(byRole('button').get());
    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should throw if we are trying to merge rule groups', async () => {
    const { user } = render(<RenameRuleGroupComponent group={grafanaRulerGroupName2} />);
    await user.click(byRole('button').get());
    expect(await byText(/error:.+not supported.+/i).find()).toBeInTheDocument();
  });

  it('should not be able to move a Grafana managed rule group', async () => {
    const { user } = render(<MoveGrafanaManagedRuleGroupComponent />);
    await user.click(byRole('button').get());
    expect(await byText(/error:.+not supported.+/i).find()).toBeInTheDocument();
  });

  it('should be able to move a Data Source managed rule group', async () => {
    mimirDataSource();
    const capture = captureRequests();

    const { user } = render(
      <MoveDataSourceManagedRuleGroupComponent namespace={NAMESPACE_2} group={'a-new-group'} interval={'2m'} />
    );
    await user.click(byRole('button').get());
    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should not move a Data Source managed rule group to namespace with existing target group name', async () => {
    mimirDataSource();

    const { user } = render(
      <MoveDataSourceManagedRuleGroupComponent namespace={NAMESPACE_2} group={namespace2[0].name} interval={'2m'} />
    );
    await user.click(byRole('button').get());
    expect(await byText(/error:.+not supported.+/i).find()).toBeInTheDocument();
  });
});

describe('reorder rules for rule group', () => {
  it('should correctly reorder rules', async () => {
    mimirDataSource();
    const capture = captureRequests();

    const swaps: SwapOperation[] = [[1, 0]];

    const { user } = render(
      <ReorderRuleGroupComponent namespace={NAMESPACE_2} group={namespace2[0].name} swaps={swaps} />
    );
    await user.click(byRole('button').get());
    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });
});

const UpdateRuleGroupComponent = () => {
  const [updateRuleGroup, requestState] = useUpdateRuleGroupConfiguration();

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

const RenameRuleGroupComponent = ({ group = 'another-group-name' }: { group?: string }) => {
  const [renameRuleGroup, requestState] = useRenameRuleGroup();

  const ruleGroupID: RuleGroupIdentifier = {
    dataSourceName: GRAFANA_RULES_SOURCE_NAME,
    groupName: grafanaRulerGroupName,
    namespaceName: grafanaRulerNamespace.uid,
  };

  return (
    <>
      <button onClick={() => renameRuleGroup.execute(ruleGroupID, group, '2m')} />
      <SerializeState state={requestState} />
    </>
  );
};

const MoveGrafanaManagedRuleGroupComponent = () => {
  const [moveRuleGroup, requestState] = useMoveRuleGroup();

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
  const [moveRuleGroup, requestState] = useMoveRuleGroup();

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

type ReorderRuleGroupComponentProps = {
  namespace: string;
  group: string;
  swaps: SwapOperation[];
};

const ReorderRuleGroupComponent = ({ namespace, group, swaps }: ReorderRuleGroupComponentProps) => {
  const [reorderRules, requestState] = useReorderRuleForRuleGroup();

  const ruleGroupID: RuleGroupIdentifier = {
    dataSourceName: MIMIR_DATASOURCE_UID,
    groupName: group,
    namespaceName: namespace,
  };

  return (
    <>
      <button onClick={() => reorderRules.execute(ruleGroupID, swaps)} />
      <SerializeState state={requestState} />
    </>
  );
};
