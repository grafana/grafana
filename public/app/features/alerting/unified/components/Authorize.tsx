import { chain, filter } from 'lodash';
import React, { PropsWithChildren } from 'react';

import {
  Abilities,
  Action,
  AlertmanagerAction,
  AlertSourceAction,
  useAlertmanagerAbilities,
  useAlertSourceAbilities,
} from '../hooks/useAbilities';

interface AuthorizeProps extends PropsWithChildren {
  actions: AlertmanagerAction[] | AlertSourceAction[];
}

export const Authorize = ({ actions, children }: AuthorizeProps) => {
  const alertmanagerActions = filter(actions, isAlertmanagerAction) as AlertmanagerAction[];
  const alertSourceActions = filter(actions, isAlertSourceAction) as AlertSourceAction[];

  if (alertmanagerActions.length) {
    return <AuthorizeAlertmanager actions={alertmanagerActions}>{children}</AuthorizeAlertmanager>;
  }

  if (alertSourceActions.length) {
    return <AuthorizeAlertsource actions={alertSourceActions}>{children}</AuthorizeAlertsource>;
  }

  return null;
};

interface ActionsProps<T extends Action> extends PropsWithChildren {
  actions: T[];
}

const AuthorizeAlertmanager = ({ actions, children }: ActionsProps<AlertmanagerAction>) => {
  const alertmanagerAbilties = useAlertmanagerAbilities();
  const allowed = actionsAllowed(alertmanagerAbilties, actions);

  if (allowed) {
    return <>{children}</>;
  } else {
    return null;
  }
};

const AuthorizeAlertsource = ({ actions, children }: ActionsProps<AlertSourceAction>) => {
  const alertSourceAbilities = useAlertSourceAbilities();
  const allowed = actionsAllowed(alertSourceAbilities, actions);

  if (allowed) {
    return <>{children}</>;
  } else {
    return null;
  }
};

// check if some action is allowed from the abilities
function actionsAllowed<T extends Action>(abilities: Abilities<T>, actions: T[]) {
  return chain(abilities)
    .pick(actions)
    .values()
    .value()
    .some(([_supported, allowed]) => allowed === true);
}

function isAlertmanagerAction(action: AlertmanagerAction) {
  return Object.values(AlertmanagerAction).includes(action);
}

function isAlertSourceAction(action: AlertSourceAction) {
  return Object.values(AlertSourceAction).includes(action);
}
