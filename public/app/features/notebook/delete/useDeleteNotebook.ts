import { t } from '@grafana/i18n';
import { useDeleteNotebookMutation } from 'app/api/clients/dashboard/v2beta1';
import { useAppNotification } from 'app/core/copy/appNotification';

import { notebookAnalytics } from '../analytics/main';
import { type NotebookDeleteSource } from '../analytics/types';

/**
 * Deletes a notebook and reports the outcome, for the two places that offer it: the list's row menu
 * and the notebook page's own toolbar.
 *
 * The list refreshes itself — the generated mutation invalidates the coarse `Notebook` tag, and the
 * hand-written search query tags itself into the same namespace precisely so writes reach it. Nothing
 * here has to refetch.
 *
 * Resolves to whether the delete succeeded rather than throwing, so a caller can close its modal
 * either way and only navigate on success.
 *
 * The caller gives the surface once, at the hook: it belongs to the caller, not to each delete.
 */
export function useDeleteNotebook(source: NotebookDeleteSource) {
  const [deleteNotebook, { isLoading }] = useDeleteNotebookMutation();
  const notifyApp = useAppNotification();

  const remove = async (uid: string, title: string): Promise<boolean> => {
    try {
      await deleteNotebook({ name: uid }).unwrap();
      notebookAnalytics.deleted(uid, source);
      notifyApp.success(t('notebooks.delete.success', 'Notebook deleted'), title);
      return true;
    } catch (error) {
      // Without this a failed delete looks like a modal that closed and did nothing.
      notifyApp.error(t('notebooks.delete.error', 'Failed to delete notebook'), title);
      return false;
    }
  };

  return { remove, isDeleting: isLoading };
}
