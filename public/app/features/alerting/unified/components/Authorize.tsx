import { chain } from 'lodash';
import { type PropsWithChildren } from 'react';

import { type AlertingAction, useAlertingAbilities } from '../hooks/useAbilities';

interface AuthorizeProps extends PropsWithChildren {
  actions: AlertingAction[];
}

export const Authorize = ({ actions, children }: AuthorizeProps) => {
  const abilities = useAlertingAbilities();
  const allowed = chain(abilities)
    .pick(actions)
    .values()
    .value()
    .some(([, permitted]) => permitted === true);

  return allowed ? <>{children}</> : null;
};
