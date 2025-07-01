import { produce } from 'immer';
import { render } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';
import { EditableRuleIdentifier, GrafanaRuleIdentifier, RuleGroupIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import {
  grafanaRulerGroup,
  grafanaRulerGroup2,
  grafanaRulerNamespace,
  grafanaRulerRule,
} from '../../mocks/grafanaRulerApi';
import { NAMESPACE_1, group1 } from '../../mocks/mimirRulerApi';
import { mimirDataSource } from '../../mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from '../../mocks/server/constants';
import { captureRequests, serializeRequests } from '../../mocks/server/events';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { fromRulerRuleAndRuleGroupIdentifier } from '../../utils/rule-id';
import { SerializeState } from '../useAsync';

import { useUpdateRuleInRuleGroup } from './useUpsertRuleFromRuleGroup';

setupMswServer();

beforeAll(() => {
  grantUserPermissions([
    AccessControlAction.AlertingRuleExternalRead,
    AccessControlAction.AlertingRuleExternalWrite,
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleCreate,
  ]);
});

describe('Updating a Grafana managed rule', () => {
  it('should update a rule in an existing group', async () => {
    const capture = captureRequests((r) => r.method === 'POST');

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: grafanaRulerGroup.name,
      namespaceName: grafanaRulerNamespace.uid,
    };

    const ruleID: GrafanaRuleIdentifier = {
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
      uid: grafanaRulerRule.grafana_alert.uid,
    };

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const { user } = render(
      <UpdateRuleTestComponent ruleGroupIdentifier={ruleGroupID} ruleID={ruleID} rule={newRule} />
    );
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should move a rule in to another group', async () => {
    const capture = captureRequests((r) => r.method === 'POST');

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: grafanaRulerGroup.name,
      namespaceName: grafanaRulerNamespace.uid,
    };

    const targetRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: grafanaRulerGroup2.name,
      namespaceName: grafanaRulerNamespace.uid,
    };

    const ruleID: GrafanaRuleIdentifier = {
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
      uid: grafanaRulerRule.grafana_alert.uid,
    };

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const { user } = render(
      <UpdateRuleTestComponent
        ruleGroupIdentifier={ruleGroupID}
        targetRuleGroupIdentifier={targetRuleGroupID}
        ruleID={ruleID}
        rule={newRule}
      />
    );
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should fail if the rule does not exist in the group', async () => {
    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: grafanaRulerGroup.name,
      namespaceName: grafanaRulerNamespace.uid,
    };

    const ruleID: GrafanaRuleIdentifier = {
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
      uid: 'does-not-exist',
    };

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const { user } = render(
      <UpdateRuleTestComponent ruleGroupIdentifier={ruleGroupID} ruleID={ruleID} rule={newRule} />
    );
    await user.click(byRole('button').get());

    expect(await byText(/error: no rule matching identifier found/i).find()).toBeInTheDocument();
  });

  it('should fail if the rule group does not exist', async () => {
    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: 'does-not-exist',
      namespaceName: 'does-not-exist',
    };

    const ruleID: GrafanaRuleIdentifier = {
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
      uid: 'does-not-exist',
    };

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const { user } = render(
      <UpdateRuleTestComponent ruleGroupIdentifier={ruleGroupID} ruleID={ruleID} rule={newRule} />
    );
    await user.click(byRole('button').get());

    expect(await byText(/error/i).find()).toBeInTheDocument();
  });
});

describe('Updating a Data source managed rule', () => {
  beforeEach(() => {
    mimirDataSource();
  });

  it('should update a rule in an existing group', async () => {
    const capture = captureRequests((r) => r.method === 'POST');

    const groupToUpdate = group1;
    const ruleToUpdate = groupToUpdate.rules[0];

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: groupToUpdate.name,
      namespaceName: NAMESPACE_1,
    };

    const ruleID = fromRulerRuleAndRuleGroupIdentifier(ruleGroupID, ruleToUpdate);

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const { user } = render(
      <UpdateRuleTestComponent ruleGroupIdentifier={ruleGroupID} ruleID={ruleID} rule={newRule} />
    );
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should be able to move a rule if target group is different from current group', async () => {
    const capture = captureRequests((r) => r.method === 'POST' || r.method === 'DELETE');

    const groupToUpdate = group1;
    const ruleToUpdate = groupToUpdate.rules[0];

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: groupToUpdate.name,
      namespaceName: NAMESPACE_1,
    };

    const targetRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: 'a new group',
      namespaceName: NAMESPACE_1,
    };

    const ruleID = fromRulerRuleAndRuleGroupIdentifier(ruleGroupID, ruleToUpdate);

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const { user } = render(
      <UpdateRuleTestComponent
        ruleGroupIdentifier={ruleGroupID}
        targetRuleGroupIdentifier={targetRuleGroupID}
        ruleID={ruleID}
        rule={newRule}
      />
    );
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should fail if the rule does not exist in the group', async () => {
    const groupToUpdate = group1;

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: groupToUpdate.name,
      namespaceName: NAMESPACE_1,
    };

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const ruleID = fromRulerRuleAndRuleGroupIdentifier(ruleGroupID, newRule);

    const { user } = render(
      <UpdateRuleTestComponent ruleGroupIdentifier={ruleGroupID} ruleID={ruleID} rule={newRule} />
    );
    await user.click(byRole('button').get());

    expect(await byText(/error: no rule matching identifier found/i).find()).toBeInTheDocument();
  });

  it('should fail if the rule group does not exist', async () => {
    const groupToUpdate = group1;
    const ruleToUpdate = groupToUpdate.rules[0];

    const ruleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: 'does-not-exist',
      namespaceName: NAMESPACE_1,
    };

    const ruleID = fromRulerRuleAndRuleGroupIdentifier(ruleGroupID, ruleToUpdate);

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const { user } = render(
      <UpdateRuleTestComponent ruleGroupIdentifier={ruleGroupID} ruleID={ruleID} rule={newRule} />
    );
    await user.click(byRole('button').get());

    expect(await byText(/error/i).find()).toBeInTheDocument();
  });
});

type UpdateRuleTestComponentProps = {
  ruleGroupIdentifier: RuleGroupIdentifier;
  targetRuleGroupIdentifier?: RuleGroupIdentifier;
  ruleID: EditableRuleIdentifier;
  rule: PostableRuleDTO;
};

const UpdateRuleTestComponent = ({
  ruleGroupIdentifier,
  targetRuleGroupIdentifier,
  ruleID,
  rule,
}: UpdateRuleTestComponentProps) => {
  const [updateRule, requestState] = useUpdateRuleInRuleGroup();

  const onClick = () => {
    updateRule.execute(ruleGroupIdentifier, ruleID, rule, targetRuleGroupIdentifier);
  };

  return (
    <>
      <button onClick={() => onClick()} />
      <SerializeState state={requestState} />
    </>
  );
};
