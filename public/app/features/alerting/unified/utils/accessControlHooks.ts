import { useMemo } from 'react';

import { getRulesAccess } from './access-control';

export function useRulesAccess() {
  return useMemo(() => getRulesAccess(), []);
}
