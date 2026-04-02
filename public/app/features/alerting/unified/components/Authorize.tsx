import { chain } from 'lodash';
import { type PropsWithChildren } from 'react';

import { useExternalRuleAbilities, useRuleAbilities } from '../hooks/useAbilities';
import {
  type Abilities,
  type Action,
  AlertmanagerAction,
  ExternalAlertmanagerAction,
  ExternalRuleAction,
  RuleAction,
} from '../hooks/useAbilities.types';
import { useAllAlertmanagerAbilities, useAllExternalAlertmanagerAbilities } from '../hooks/useAlertmanagerAbilities';

interface AuthorizeProps extends PropsWithChildren {
  actions: AlertmanagerAction[] | ExternalAlertmanagerAction[] | RuleAction[] | ExternalRuleAction[];
}

export const Authorize = ({ actions, children }: AuthorizeProps) => {
  const alertmanagerActions = actions.filter(isAlertmanagerAction);
  const externalAlertmanagerActions = actions.filter(isExternalAlertmanagerAction);
  const grafanaRuleActions = actions.filter(isGrafanaRuleAction);
  const externalRuleActions = actions.filter(isExternalRuleAction);

  if (alertmanagerActions.length) {
    return <AuthorizeAlertmanager actions={alertmanagerActions}>{children}</AuthorizeAlertmanager>;
  }

  if (externalAlertmanagerActions.length) {
    return (
      <AuthorizeExternalAlertmanager actions={externalAlertmanagerActions}>{children}</AuthorizeExternalAlertmanager>
    );
  }

  if (grafanaRuleActions.length) {
    return <AuthorizeGrafanaRule actions={grafanaRuleActions}>{children}</AuthorizeGrafanaRule>;
  }

  if (externalRuleActions.length) {
    return <AuthorizeExternalRule actions={externalRuleActions}>{children}</AuthorizeExternalRule>;
  }

  return null;
};

interface ActionsProps<T extends Action> extends PropsWithChildren {
  actions: T[];
}

const AuthorizeAlertmanager = ({ actions, children }: ActionsProps<AlertmanagerAction>) => {
  const abilities = useAllAlertmanagerAbilities();
  const allowed = actionsAllowed(abilities, actions);
  return allowed ? <>{children}</> : null;
};

const AuthorizeExternalAlertmanager = ({ actions, children }: ActionsProps<ExternalAlertmanagerAction>) => {
  const abilities = useAllExternalAlertmanagerAbilities();
  const allowed = actionsAllowed(abilities, actions);
  return allowed ? <>{children}</> : null;
};

const AuthorizeGrafanaRule = ({ actions, children }: ActionsProps<RuleAction>) => {
  const abilities = useRuleAbilities();
  const allowed = actionsAllowed(abilities, actions);
  return allowed ? <>{children}</> : null;
};

const AuthorizeExternalRule = ({ actions, children }: ActionsProps<ExternalRuleAction>) => {
  const abilities = useExternalRuleAbilities();
  const allowed = actionsAllowed(abilities, actions);
  return allowed ? <>{children}</> : null;
};

// TODO add some authorize helper components for alert source and individual alert rules

// check if some action is allowed from the abilities
function actionsAllowed<T extends Action>(abilities: Abilities<T>, actions: T[]) {
  return chain(abilities)
    .pick(actions)
    .values()
    .value()
    .some(([_supported, allowed]) => allowed === true);
}

const alertmanagerActionSet = new Set<Action>(Object.values(AlertmanagerAction));
const externalAlertmanagerActionSet = new Set<Action>(Object.values(ExternalAlertmanagerAction));
const grafanaRuleActionSet = new Set<Action>(Object.values(RuleAction));
const externalRuleActionSet = new Set<Action>(Object.values(ExternalRuleAction));

function isAlertmanagerAction(action: Action): action is AlertmanagerAction {
  return alertmanagerActionSet.has(action);
}

function isExternalAlertmanagerAction(action: Action): action is ExternalAlertmanagerAction {
  return externalAlertmanagerActionSet.has(action);
}

function isGrafanaRuleAction(action: Action): action is RuleAction {
  return grafanaRuleActionSet.has(action);
}

function isExternalRuleAction(action: Action): action is ExternalRuleAction {
  return externalRuleActionSet.has(action);
}
