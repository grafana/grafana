import { produce } from 'immer';
import { render } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';
import { EditableRuleIdentifier, GrafanaRuleIdentifier, RuleGroupIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import {
  grafanaRulerEmptyGroup,
  grafanaRulerGroup,
  grafanaRulerNamespace,
  grafanaRulerRule,
} from '../../mocks/grafanaRulerApi';
import { group1, GROUP_3, NAMESPACE_1, NAMESPACE_2 } from '../../mocks/mimirRulerApi';
import { mimirDataSource } from '../../mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from '../../mocks/server/constants';
import { captureRequests, serializeRequests } from '../../mocks/server/events';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { fromRulerRuleAndRuleGroupIdentifier } from '../../utils/rule-id';
import { SerializeState } from '../useAsync';

import { useMoveRuleToRuleGroup } from './useUpsertRuleFromRuleGroup';

setupMswServer();

beforeAll(() => {
  grantUserPermissions([
    AccessControlAction.AlertingRuleExternalRead,
    AccessControlAction.AlertingRuleExternalWrite,
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleCreate,
  ]);
});

describe('Moving a Grafana managed rule', () => {
  it('should move a rule from an existing group to another group in the same namespace', async () => {
    const capture = captureRequests((r) => r.method === 'POST');

    const currentGroup = grafanaRulerGroup;
    const targetGroup = grafanaRulerEmptyGroup;

    const ruleToMove = grafanaRulerGroup.rules[0];

    const currentRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: currentGroup.name,
      namespaceName: grafanaRulerNamespace.uid,
    };

    const targetRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: targetGroup.name,
      namespaceName: grafanaRulerNamespace.uid,
    };

    const ruleID = fromRulerRuleAndRuleGroupIdentifier(currentRuleGroupID, ruleToMove);

    const { user } = render(
      <MoveRuleTestComponent
        currentRuleGroupIdentifier={currentRuleGroupID}
        targetRuleGroupIdentifier={targetRuleGroupID}
        ruleID={ruleID}
        rule={ruleToMove}
      />
    );
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should fail if the rule group does not exist', async () => {
    const currentRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      groupName: 'does-not-exist',
      namespaceName: 'does-not-exist',
    };

    const ruleID: GrafanaRuleIdentifier = {
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
      uid: 'does-not-exist',
    };

    const { user } = render(
      <MoveRuleTestComponent
        currentRuleGroupIdentifier={currentRuleGroupID}
        targetRuleGroupIdentifier={currentRuleGroupID}
        ruleID={ruleID}
        rule={grafanaRulerRule}
      />
    );
    await user.click(byRole('button').get());

    expect(await byText(/error/i).find()).toBeInTheDocument();
  });
});

describe('Moving a Data source managed rule', () => {
  beforeEach(() => {
    mimirDataSource();
  });

  it('should move a rule in an existing group to a new group', async () => {
    const capture = captureRequests((r) => r.method === 'POST' || r.method === 'DELETE');

    const groupToUpdate = group1;
    const ruleToMove = groupToUpdate.rules[0];

    const currentRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: groupToUpdate.name,
      namespaceName: NAMESPACE_1,
    };

    const targetRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: 'entirely new group name',
      namespaceName: NAMESPACE_1,
    };

    const ruleID = fromRulerRuleAndRuleGroupIdentifier(currentRuleGroupID, ruleToMove);

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const { user } = render(
      <MoveRuleTestComponent
        currentRuleGroupIdentifier={currentRuleGroupID}
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

  it('should move a rule in an existing group to another existing group', async () => {
    const capture = captureRequests((r) => r.method === 'POST' || r.method === 'DELETE');

    const groupToUpdate = group1;
    const ruleToMove = groupToUpdate.rules[0];

    const currentRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: groupToUpdate.name,
      namespaceName: NAMESPACE_1,
    };

    const targetRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: GROUP_3,
      namespaceName: NAMESPACE_2,
    };

    const ruleID = fromRulerRuleAndRuleGroupIdentifier(currentRuleGroupID, ruleToMove);

    const { user } = render(
      <MoveRuleTestComponent
        currentRuleGroupIdentifier={currentRuleGroupID}
        targetRuleGroupIdentifier={targetRuleGroupID}
        ruleID={ruleID}
        rule={ruleToMove}
      />
    );
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should move a rule in a namespace to another existing namespace', async () => {
    const capture = captureRequests((r) => r.method === 'POST' || r.method === 'DELETE');

    const ruleToMove = group1.rules[0];

    const coreRuleGroup = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: group1.name,
    };

    const currentRuleGroupID: RuleGroupIdentifier = {
      ...coreRuleGroup,
      namespaceName: NAMESPACE_1,
    };

    const targetRuleGroupID: RuleGroupIdentifier = {
      ...coreRuleGroup,
      namespaceName: NAMESPACE_2,
    };

    const ruleID = fromRulerRuleAndRuleGroupIdentifier(currentRuleGroupID, ruleToMove);

    const { user } = render(
      <MoveRuleTestComponent
        currentRuleGroupIdentifier={currentRuleGroupID}
        targetRuleGroupIdentifier={targetRuleGroupID}
        ruleID={ruleID}
        rule={ruleToMove}
      />
    );
    await user.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should fail if the rule group does not exist', async () => {
    const groupToUpdate = group1;
    const ruleToUpdate = groupToUpdate.rules[0];

    const curentRuleGroupID: RuleGroupIdentifier = {
      dataSourceName: MIMIR_DATASOURCE_UID,
      groupName: 'does-not-exist',
      namespaceName: NAMESPACE_1,
    };

    const ruleID = fromRulerRuleAndRuleGroupIdentifier(curentRuleGroupID, ruleToUpdate);

    const newRule = produce(grafanaRulerRule, (draft) => {
      draft.grafana_alert.title = 'updated rule title';
    });

    const { user } = render(
      <MoveRuleTestComponent
        currentRuleGroupIdentifier={curentRuleGroupID}
        targetRuleGroupIdentifier={curentRuleGroupID}
        ruleID={ruleID}
        rule={newRule}
      />
    );
    await user.click(byRole('button').get());

    expect(await byText(/error/i).find()).toBeInTheDocument();
  });
});

type MoveRuleTestComponentProps = {
  currentRuleGroupIdentifier: RuleGroupIdentifier;
  targetRuleGroupIdentifier: RuleGroupIdentifier;
  ruleID: EditableRuleIdentifier;
  rule: PostableRuleDTO;
};

const MoveRuleTestComponent = ({
  currentRuleGroupIdentifier,
  targetRuleGroupIdentifier,
  ruleID,
  rule,
}: MoveRuleTestComponentProps) => {
  const [moveRule, requestState] = useMoveRuleToRuleGroup();

  const onClick = () => {
    moveRule.execute(currentRuleGroupIdentifier, targetRuleGroupIdentifier, ruleID, rule);
  };

  return (
    <>
      <button onClick={() => onClick()} />
      <SerializeState state={requestState} />
    </>
  );
};
