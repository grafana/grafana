import { render } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockGrafanaRulerRule, mockRulerAlertingRule } from '../../mocks';
import { grafanaRulerGroupName, grafanaRulerNamespace } from '../../mocks/grafanaRulerApi';
import { GROUP_1, NAMESPACE_1 } from '../../mocks/mimirRulerApi';
import { mimirDataSource } from '../../mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from '../../mocks/server/constants';
import { captureRequests, serializeRequests } from '../../mocks/server/events';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { SerializeState } from '../useAsync';

import { useAddRuleToRuleGroup } from './useUpsertRuleFromRuleGroup';

setupMswServer();

beforeAll(() => {
  grantUserPermissions([
    AccessControlAction.AlertingRuleExternalRead,
    AccessControlAction.AlertingRuleExternalWrite,
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleCreate,
  ]);
});

describe('Creating a Grafana managed rule', () => {
  it('should be able to add a rule to a existing rule group', async () => {
    const capture = captureRequests((r) => r.method === 'POST');

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: grafanaRulerGroupName,
      namespaceName: grafanaRulerNamespace.uid,
    };

    const rule = mockGrafanaRulerRule({ title: 'my new rule' });

    const { user } = render(<AddRuleTestComponent ruleGroupIdentifier={ruleGroupID} rule={rule} />);
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should be able to add a rule to a new rule group', async () => {
    const capture = captureRequests((r) => r.method === 'POST');

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: 'grafana-group-3',
      namespaceName: grafanaRulerNamespace.uid,
    };

    const rule = mockGrafanaRulerRule({ title: 'my new rule' });

    const { user } = render(<AddRuleTestComponent ruleGroupIdentifier={ruleGroupID} rule={rule} interval="15m" />);
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should not be able to add a rule to a non-existing namespace', async () => {
    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: grafanaRulerGroupName,
      namespaceName: 'does-not-exist',
    };

    const rule = mockGrafanaRulerRule({ title: 'my new rule' });

    const { user } = render(<AddRuleTestComponent ruleGroupIdentifier={ruleGroupID} rule={rule} />);
    await user.click(byRole('button').get());

    expect(await byText(/error/i).find()).toBeInTheDocument();
  });
});

describe('Creating a Data source managed rule', () => {
  beforeEach(() => {
    mimirDataSource();
  });

  it('should be able to add a rule to a existing rule group', async () => {
    const capture = captureRequests((r) => r.method === 'POST');

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: GROUP_1,
      namespaceName: NAMESPACE_1,
    };

    const rule = mockRulerAlertingRule({ alert: 'my new rule' });

    const { user } = render(<AddRuleTestComponent ruleGroupIdentifier={ruleGroupID} rule={rule} />);
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should be able to add a rule to a new rule group', async () => {
    const capture = captureRequests((r) => r.method === 'POST');

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: 'new group',
      namespaceName: 'new namespace',
    };

    const rule = mockGrafanaRulerRule({ title: 'my new rule' });

    const { user } = render(<AddRuleTestComponent ruleGroupIdentifier={ruleGroupID} rule={rule} interval="15m" />);
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });
});

type AddRuleTestComponentProps = {
  ruleGroupIdentifier: RuleGroupIdentifier;
  rule: PostableRuleDTO;
  interval?: string;
};

const AddRuleTestComponent = ({ ruleGroupIdentifier, rule, interval }: AddRuleTestComponentProps) => {
  const [addRule, requestState] = useAddRuleToRuleGroup();

  const onClick = () => {
    addRule.execute(ruleGroupIdentifier, rule, interval);
  };

  return (
    <>
      <button onClick={() => onClick()} />
      <SerializeState state={requestState} />
    </>
  );
};
