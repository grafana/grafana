import { createContext } from 'react';

import type { Description } from './types';

export const emptyDescription: Description = {
  resource: '',
  assignments: {
    users: false,
    serviceAccounts: false,
    teams: false,
    builtInRoles: false,
  },
  permissions: [],
  fineGrainedActions: [],
};

export const ResourceDescriptionCtx = createContext<Description>(emptyDescription);
