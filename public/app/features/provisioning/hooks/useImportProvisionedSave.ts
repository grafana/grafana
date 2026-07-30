import { useCallback, useState } from 'react';
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

  const [createFile, request] = useCreateOrUpdateRepositoryFile();

  const { handleSuccess } = useProvisionedRequestHandler({
    resourceType: 'dashboard',
    repository,
  });

  const save = useCallback(
    async ({ spec, apiVersion, uid, folderUid: targetFolderUid, title, form }: ImportProvisionedSaveParams) => {
      if (!repository) {
        return;
      }
      setError(undefined);

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

      try {
        const data = await createFile({
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
        }).unwrap();

        handleSuccess(data, {
          workflow: form.workflow,
          folderUID: targetFolderUid,
          selectedBranch: form.ref,
          handlers: {
            onWriteSuccess: (upsert) => {
              // Sync-disabled repositories can return success without creating a
              // Grafana k8s resource. Fall back to the folder view when we don't
              // have a dashboard uid to navigate to.
              const dashboardUid = upsert?.metadata?.name;
              if (!dashboardUid) {
                navigate(
                  locationUtil.assureBaseUrl(targetFolderUid ? `/dashboards/f/${targetFolderUid}/` : '/dashboards')
                );
                return;
              }
              const url = locationUtil.assureBaseUrl(
                getDashboardUrl({
                  uid: dashboardUid,
                  slug: kbn.slugifyForUrl(title),
                  currentQueryParams: window.location.search,
                })
              );
              navigate(url);
            },
            onBranchSuccess: ({ ref, path }, info) => {
              const url = buildResourceBranchRedirectUrl({
                baseUrl: `${PROVISIONING_PREVIEW_URL}/${repository.name}/preview/${path}`,
                paramName: 'ref',
                paramValue: ref,
                repoType: info.repoType,
              });
              navigate(url);
            },
          },
        });
      } catch (err) {
        setError(
          getProvisionedRequestError(
            err,
            t('provisioning.import.error', 'An error occurred while importing the dashboard.')
          )
        );
      }
    },
    [repository, createFile, handleSuccess, navigate]
  );

  return { save, isLoading: request.isLoading ?? false, error };
}
