/**
 * useCollab — convenience hook for consuming CollabContext.
 */

import { useContext } from 'react';

import { CollabContext, type CollabContextValue } from './CollabContext';

export function useCollab(): CollabContextValue {
  return useContext(CollabContext);
}
