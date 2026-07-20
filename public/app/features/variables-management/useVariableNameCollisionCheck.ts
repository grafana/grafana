import { skipToken } from '@reduxjs/toolkit/query/react';
import { useState } from 'react';
import { useDebounce } from 'react-use';

import { t } from '@grafana/i18n';
import { useGetVariableQuery } from 'app/api/clients/dashboard/v2beta1';

import { deriveVariableMetadataName } from './utils';

const NAME_CHECK_DEBOUNCE_MS = 400;

export interface VariableNameCollisionCheck {
  /** True while the typed name has not yet been debounced, or the existence query is in flight. */
  isChecking: boolean;
  /** Set when another Variable already owns the derived metadata.name in this scope. */
  collisionError?: string;
}

/** Pure decision helper — kept separate so unit tests do not need the RTK hook. */
export function evaluateVariableNameCollision(args: {
  shouldQuery: boolean;
  isFetching: boolean;
  isDebouncing: boolean;
  data: unknown;
  error: unknown;
}): { isChecking: boolean; nameTaken: boolean } {
  const { shouldQuery, isFetching, isDebouncing, data, error } = args;
  // Success with a body → name taken. 404 / other errors → treat as free (fail open on
  // non-404 so a transient blip does not permanently disable Save).
  const nameTaken = shouldQuery && !isFetching && data != null && error == null;
  return {
    isChecking: (shouldQuery && isFetching) || isDebouncing,
    nameTaken,
  };
}

/**
 * Debounced existence check for standalone variable create/rename — same idea as
 * SaveDashboardAsForm's validationSrv title check. Looks up the derived
 * metadata.name via getVariable; 404 means the name is free. Skips the request
 * when the derived name is the resource currently being edited.
 */
export function useVariableNameCollisionCheck(
  logicalName: string,
  folderUid: string,
  /** metadata.name of the variable being edited; undefined when creating. */
  editingResourceName?: string,
  /** Skip while local format validation already failed (name may not be committed). */
  skip?: boolean
): VariableNameCollisionCheck {
  const [debouncedName, setDebouncedName] = useState(logicalName);
  useDebounce(() => setDebouncedName(logicalName), NAME_CHECK_DEBOUNCE_MS, [logicalName]);

  const isDebouncing = logicalName !== debouncedName;
  // Folder is not debounced so changing scope re-checks immediately (Save As does the same).
  const resourceName = debouncedName ? deriveVariableMetadataName(debouncedName, folderUid || undefined) : '';
  const isEditingSelf = Boolean(editingResourceName && resourceName === editingResourceName);
  const shouldQuery = Boolean(resourceName) && !skip && !isDebouncing && !isEditingSelf;

  const { data, error, isFetching } = useGetVariableQuery(shouldQuery ? { name: resourceName } : skipToken);

  const { isChecking, nameTaken } = evaluateVariableNameCollision({
    shouldQuery,
    isFetching,
    isDebouncing,
    data,
    error,
  });

  return {
    isChecking,
    collisionError: nameTaken
      ? t('variables-management.editor.name-exists', 'A variable with this name already exists in the selected folder')
      : undefined,
  };
}
