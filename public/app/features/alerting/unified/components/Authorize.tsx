import { chain, filter } from 'lodash';
import React, { PropsWithChildren } from 'react';

import {
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

  const abilities = chain(alertmanagerAbilties).pick(actions).values().value();
  const allowed = abilities.some(([_supported, allowed]) => allowed === true);

  if (allowed) {
    return <>{children}</>;
  } else {
    return null;
  }
};

const AuthorizeAlertsource = ({ actions, children }: ActionsProps<AlertSourceAction>) => {
  const alertSourceAbilities = useAlertSourceAbilities();

  const abilities = chain(alertSourceAbilities).pick(actions).values().value();
  const allowed = abilities.some(([_supported, allowed]) => allowed === true);

  if (allowed) {
    return <>{children}</>;
  } else {
    return null;
  }
};

function isAlertmanagerAction(action: AlertmanagerAction) {
  return Object.values(AlertmanagerAction).includes(action);
}

function isAlertSourceAction(action: AlertSourceAction) {
  return Object.values(AlertSourceAction).includes(action);
}
