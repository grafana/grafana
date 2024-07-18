import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { grafanaRulerGroupName2, grafanaRulerGroupName, grafanaRulerNamespace } from '../../mocks/grafanaRulerApi';
import { NAMESPACE_2, namespace2, GROUP_1, NAMESPACE_1 } from '../../mocks/mimirRulerApi';
import { mimirDataSource } from '../../mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from '../../mocks/server/constants';
import { captureRequests, serializeRequests } from '../../mocks/server/events';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { SerializeState } from '../useAsync';

import { useMoveRuleGroup, useRenameRuleGroup, useUpdateRuleGroupConfiguration } from './useUpdateRuleGroup';

setupMswServer();

beforeAll(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleRead]);
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

  it('should throw if we are trying to merge rule groups', async () => {
    render(<RenameRuleGroupComponent group={grafanaRulerGroupName2} />);
    await userEvent.click(byRole('button').get());
    expect(await byText(/error:.+not supported.+/i).find()).toBeInTheDocument();
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

const RenameRuleGroupComponent = ({ group = 'another-group-name' }: { group?: string }) => {
  const [requestState, renameRuleGroup] = useRenameRuleGroup();

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
