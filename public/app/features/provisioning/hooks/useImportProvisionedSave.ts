import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import kbn from 'app/core/utils/kbn';
import { AnnoKeyFolder, type ResourceForCreate } from 'app/features/apiserver/types';
import {
  DASHBOARD_API_GROUP,
  dashboardAPIVersionResolver,
} from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { PROVISIONING_PREVIEW_URL } from 'app/features/provisioning/constants';
import { getSingleResourceCommitMessage } from 'app/features/provisioning/utils/commitMessage';
import { buildResourceBranchRedirectUrl } from 'app/features/provisioning/utils/redirect';

import { getProvisionedRequestError } from '../components/utils/errors';

import { useCreateOrUpdateRepositoryFile } from './useCreateOrUpdateRepositoryFile';
import { useProvisionedRequestHandler } from './useProvisionedRequestHandler';

export interface ImportProvisionedSaveParams {
  /** Dashboard spec — already processed through applyV1Inputs/applyV2Inputs and stripped. */
  spec: unknown;
  /** Which schema version to use for the resource apiVersion. */
  apiVersion: 'v1' | 'v2';
  /** If the user chose to override the UID, pass it here. Otherwise omit for server-generated name. */
  uid?: string;
  /** UID of the target folder. */
  folderUid: string;
  /** Dashboard title — used for the default commit message and post-save URL slug. */
  title: string;
  /** Form values from the provisioning fields. */
  form: {
    ref: string;
    path: string;
    comment?: string;
    workflow?: string;
  };
}

/**
 * Hook for importing a dashboard into a provisioned (repo-managed) folder.
 *
 * Builds a ResourceForCreate body, dispatches the create-file mutation, and wires
 * navigation on success / error state on failure via useProvisionedRequestHandler.
 *
 * Always creates (never updates) — import is always a new file.
 */
export function useImportProvisionedSave({ repository }: { repository?: RepositoryView }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>();

  // Per-save context for the request handler effect.
  // State values are useProvisionedRequestHandler effect deps; ref values are
  // only read inside handler callbacks at invocation time.
  const [saveState, setSaveState] = useState<{
    workflow?: string;
    folderUID?: string;
    selectedBranch?: string;
  }>({});
  const saveRef = useRef<{ title: string; activeRepo: RepositoryView | undefined }>({
    title: '',
    activeRepo: undefined,
  });

  const [createFile, request] = useCreateOrUpdateRepositoryFile();

  useProvisionedRequestHandler({
    ...saveState,
    request,
    resourceType: 'dashboard',
    repository,
    handlers: {
      onWriteSuccess: (upsert) => {
        // Sync-disabled repositories can return success without creating a
        // Grafana k8s resource. Fall back to the folder view when we don't
        // have a dashboard uid to navigate to.
        const uid = upsert?.metadata?.name;
        if (!uid) {
          navigate(
            locationUtil.assureBaseUrl(saveState.folderUID ? `/dashboards/f/${saveState.folderUID}/` : '/dashboards')
          );
          return;
        }
        const url = locationUtil.assureBaseUrl(
          getDashboardUrl({
            uid,
            slug: kbn.slugifyForUrl(saveRef.current.title),
            currentQueryParams: window.location.search,
          })
        );
        navigate(url);
      },
      onBranchSuccess: ({ ref, path }, info) => {
        const repo = saveRef.current.activeRepo;
        if (!repo) {
          return;
        }
        const url = buildResourceBranchRedirectUrl({
          baseUrl: `${PROVISIONING_PREVIEW_URL}/${repo.name}/preview/${path}`,
          paramName: 'ref',
          paramValue: ref,
          repoType: info.repoType,
        });
        navigate(url);
      },
      onError: (err) => {
        setError(
          getProvisionedRequestError(
            err,
            'dashboard',
            t('provisioning.import.error', 'An error occurred while importing the dashboard.')
          )
        );
      },
    },
  });

  const save = useCallback(
    async ({ spec, apiVersion, uid, folderUid: targetFolderUid, title, form }: ImportProvisionedSaveParams) => {
      if (!repository) {
        return;
      }
      saveRef.current = { title, activeRepo: repository };
      setError(undefined);
      setSaveState({ workflow: form.workflow, folderUID: targetFolderUid, selectedBranch: form.ref });

      // Ensure version negotiation has run; getV1/getV2 fall back to beta otherwise.
      const versions = await dashboardAPIVersionResolver.resolve();
      const resolvedVersion = apiVersion === 'v2' ? versions.v2 : versions.v1;

      const body: ResourceForCreate<unknown> = {
        apiVersion: `${DASHBOARD_API_GROUP}/${resolvedVersion}`,
        kind: 'Dashboard',
        metadata: {
          annotations: { [AnnoKeyFolder]: targetFolderUid },
          ...(uid ? { name: uid } : { generateName: 'd' }),
        },
        spec,
      };

      createFile({
        name: repository.name,
        path: form.path,
        ref: form.ref === repository.branch ? undefined : form.ref,
        message: getSingleResourceCommitMessage({
          comment: form.comment,
          repository,
          action: 'create',
          resourceKind: 'dashboard',
          resourceID: uid ?? '',
          title,
        }),
        body,
      });
    },
    [repository, createFile]
  );

  return { save, isLoading: request.isLoading ?? false, error };
}
