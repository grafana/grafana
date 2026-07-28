import { useEffect, useState } from 'react';

import { BASE_URL } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { dashboardAPIv2beta1, type Variable, type VariableList } from 'app/api/clients/dashboard/v2beta1';
import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { extractErrorMessage } from 'app/api/utils';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { clearPredefinedVariablesCache } from 'app/features/dashboard-scene/utils/predefinedVariables';
import { dispatch } from 'app/store/store';

import { buildVariableResource, getVariableFolderUid, getVariableKind, getVariableSpecName } from './utils';

const LIST_PAGE_SIZE = 500;

const variableListTag = { type: 'Variable' as const, id: 'LIST' };

/**
 * Clears caches so dashboards pick up Variable CRUD without a hard refresh.
 * Owned by variables-management (mutation sites), not the API client veneer.
 */
export function invalidatePredefinedVariableCaches() {
  clearPredefinedVariablesCache();
  getDashboardScenePageStateManager().clearSceneCache();
}

function invalidateAfterVariableMutation() {
  dispatch(dashboardAPIv2beta1.util.invalidateTags([variableListTag]));
  invalidatePredefinedVariableCaches();
}

/**
 * Lists every Variable resource by paging through the k8s-style list endpoint with
 * limit + continue tokens, so a single unbounded response is never requested. This
 * hook is the data-fetching seam for the variables tree: if fetch-all proves not to
 * scale, swap this for a per-folder labelSelector strategy without touching the UI.
 */
const variablesManagementAPI = dashboardAPIv2beta1.injectEndpoints({
  endpoints: (build) => ({
    listAllVariables: build.query<Variable[], void>({
      queryFn: async (_arg, _api, _extraOptions, baseQuery) => {
        const items: Variable[] = [];
        let continueToken: string | undefined;

        do {
          const result = await baseQuery({
            url: '/variables',
            params: { limit: LIST_PAGE_SIZE, ...(continueToken ? { continue: continueToken } : {}) },
          });
          if (result.error) {
            return { error: result.error };
          }
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const list = result.data as VariableList;
          items.push(...(list.items ?? []));
          continueToken = list.metadata?.continue || undefined;
        } while (continueToken);

        return { data: items };
      },
      providesTags: (result) =>
        result
          ? [
              variableListTag,
              ...result
                .map((variable) => ({ type: 'Variable' as const, id: variable.metadata?.name }))
                .filter((tag) => tag.id != null),
            ]
          : [variableListTag],
    }),
  }),
});

export const { useListAllVariablesQuery } = variablesManagementAPI;

/** Resolves folder titles for the given folder UIDs, falling back to the UID itself. */
export function useFolderTitles(folderUids: string[]): Record<string, string> {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const key = folderUids.join(',');

  useEffect(() => {
    let cancelled = false;
    const uids = key ? key.split(',') : [];
    const missing = uids.filter((uid) => !(uid in titles));
    if (missing.length === 0) {
      return;
    }

    Promise.all(
      missing.map(async (uid) => {
        const subscription = dispatch(folderAPIv1beta1.endpoints.getFolder.initiate({ name: uid }));
        try {
          const result = await subscription;
          return [uid, result.data?.spec.title ?? uid] as const;
        } finally {
          // Release the cache subscription; the resolved title lives in local state.
          subscription.unsubscribe();
        }
      })
    ).then((entries) => {
      if (!cancelled) {
        setTitles((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return titles;
}

export interface BulkOperationResult {
  succeeded: number;
  /** Variables that were already in the requested state, so no calls were made. */
  skipped: number;
  failed: Array<{ name: string; metadataName: string; error: unknown }>;
}

export interface RecreateVariableResult {
  /** False when the copy was created but the original could not be removed. */
  deletedOriginal: boolean;
}

/**
 * Replaces a variable with a new definition under a different name and/or folder
 * scope. Both change the derived metadata.name, which the backend rejects on
 * update, so the copy is created first and the original only deleted once it
 * exists — a failure can never lose the variable. Uses direct backend calls
 * instead of the RTK mutations so the caller can show a single operation-specific
 * notification instead of separate "created" + "deleted" toasts.
 *
 * A create failure throws (nothing changed). A delete failure does not: the copy
 * already exists, so the operation is surfaced as a warning about the leftover
 * original and reported via {@link RecreateVariableResult.deletedOriginal}.
 */
export async function recreateVariable(
  sourceMetadataName: string,
  kind: VariableKind,
  targetFolderUid?: string
): Promise<RecreateVariableResult> {
  await getBackendSrv().post(`${BASE_URL}/variables`, buildVariableResource(kind, targetFolderUid));
  let deletedOriginal = true;
  try {
    await getBackendSrv().delete(`${BASE_URL}/variables/${encodeURIComponent(sourceMetadataName)}`, undefined, {
      showErrorAlert: false,
    });
  } catch (error) {
    notifyDeleteAfterCreateFailed(error);
    deletedOriginal = false;
  }
  // Always invalidate: the copy exists whether or not the original was removed.
  invalidateAfterVariableMutation();
  return { deletedOriginal };
}

/**
 * Deletes the given variables one by one. Uses direct backend calls instead of the
 * RTK mutations so a bulk operation produces a single summary notification instead
 * of one toast per variable; the RTK cache is invalidated once at the end.
 */
export async function bulkDeleteVariables(variables: Variable[]): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { succeeded: 0, skipped: 0, failed: [] };

  for (const variable of variables) {
    const name = variable.metadata.name;
    if (!name) {
      continue;
    }
    try {
      await getBackendSrv().delete(`${BASE_URL}/variables/${encodeURIComponent(name)}`, undefined, {
        showErrorAlert: false,
      });
      result.succeeded++;
    } catch (error) {
      result.failed.push({ name: getVariableSpecName(variable), metadataName: name, error });
    }
  }

  invalidateAfterVariableMutation();
  return result;
}

/**
 * Moves variables to another folder scope (undefined = global). The backend rejects
 * changing the folder scope on update, so a move is create-then-delete: the copy is
 * created in the target scope first, and the original is only deleted once the copy
 * exists, so a failure can never lose the variable.
 *
 * Create failures are reported in {@link BulkOperationResult.failed} (safe to retry).
 * Delete-after-create failures match {@link recreateVariable}: a warning about the
 * leftover original is shown, and the item is not marked failed (retry would conflict
 * on create) or succeeded (the original remains).
 */
export async function bulkMoveVariables(variables: Variable[], targetFolderUid?: string): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { succeeded: 0, skipped: 0, failed: [] };

  for (const variable of variables) {
    const name = variable.metadata.name;
    if (!name) {
      continue;
    }
    if (getVariableFolderUid(variable) === targetFolderUid) {
      // Already in the target scope; report separately so the "moved" toast is honest.
      result.skipped++;
      continue;
    }

    const resource = buildVariableResource(getVariableKind(variable), targetFolderUid);
    try {
      await getBackendSrv().post(`${BASE_URL}/variables`, resource, { showErrorAlert: false });
    } catch (error) {
      result.failed.push({ name: getVariableSpecName(variable), metadataName: name, error });
      continue;
    }

    try {
      await getBackendSrv().delete(`${BASE_URL}/variables/${encodeURIComponent(name)}`, undefined, {
        showErrorAlert: false,
      });
      result.succeeded++;
    } catch (error) {
      // Copy exists in the target; don't mark failed (retry would re-POST) or succeeded.
      notifyDeleteAfterCreateFailed(error);
    }
  }

  invalidateAfterVariableMutation();
  return result;
}

function notifyDeleteAfterCreateFailed(error: unknown) {
  dispatch(
    notifyApp(
      createWarningNotification(
        t(
          'variables-management.recreate.delete-failed',
          'The variable was saved to the new location, but the previous version could not be removed. Delete it manually to avoid duplicates.'
        ),
        extractErrorMessage(error, '')
      )
    )
  );
}
