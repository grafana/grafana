import { chain } from 'lodash';
import React from 'react';

import { Action, useAbilities } from '../hooks/useAbilities';

type Props = {
  actions: Action[];
};

export const Authorize = ({ actions, children }: React.PropsWithChildren<Props>) => {
  const allAbilities = useAbilities();

  const abilities = chain(allAbilities).pick(actions).values().value();
  const allowed = abilities.some(([_supported, allowed]) => allowed === true);

  if (allowed) {
    return <>{children}</>;
  } else {
    return null;
  }
};
