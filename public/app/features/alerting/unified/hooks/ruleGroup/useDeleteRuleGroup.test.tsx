import { render } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { grafanaRulerGroupName, grafanaRulerNamespace } from '../../mocks/grafanaRulerApi';
import { GROUP_1, NAMESPACE_1 } from '../../mocks/mimirRulerApi';
import { mimirDataSource } from '../../mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from '../../mocks/server/constants';
import { captureRequests, serializeRequests } from '../../mocks/server/events';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { SerializeState } from '../useAsync';

import { useDeleteRuleGroup } from './useDeleteRuleGroup';

setupMswServer();

beforeAll(() => {
  grantUserPermissions([
    AccessControlAction.AlertingRuleExternalWrite,
    AccessControlAction.AlertingRuleExternalRead,
    AccessControlAction.AlertingRuleDelete,
    AccessControlAction.AlertingRuleRead,
  ]);
});

describe('data-source managed', () => {
  it('should be able to delete a data-source managed rule group', async () => {
    mimirDataSource();

    const capture = captureRequests((r) => r.method === 'DELETE');

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: GROUP_1,
      namespaceName: NAMESPACE_1,
    };

    const { user } = render(<DeleteTestComponent ruleGroupIdentifier={ruleGroupID} />);
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });
});

describe('Grafana managed', () => {
  it('should be able to delete a Grafana managed rule group', async () => {
    const capture = captureRequests((r) => r.method === 'DELETE');

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: grafanaRulerGroupName,
      namespaceName: grafanaRulerNamespace.uid,
    };

    const { user } = render(<DeleteTestComponent ruleGroupIdentifier={ruleGroupID} />);
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });
});

type DeleteTestComponentProps = {
  ruleGroupIdentifier: RuleGroupIdentifier;
};
const DeleteTestComponent = ({ ruleGroupIdentifier }: DeleteTestComponentProps) => {
  const [deleteRuleGroup, requestState] = useDeleteRuleGroup();

  const onClick = () => {
    deleteRuleGroup.execute(ruleGroupIdentifier);
  };

  return (
    <>
      <button onClick={() => onClick()} />
      <SerializeState state={requestState} />
    </>
  );
};
