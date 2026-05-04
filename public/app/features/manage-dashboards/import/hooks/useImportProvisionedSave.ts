import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import kbn from 'app/core/utils/kbn';
import { AnnoKeyFolder, type ResourceForCreate } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { getProvisionedRequestError } from 'app/features/provisioning/components/utils/errors';
import { PROVISIONING_PREVIEW_URL } from 'app/features/provisioning/constants';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile';
import { useProvisionedRequestHandler } from 'app/features/provisioning/hooks/useProvisionedRequestHandler';
import { buildResourceBranchRedirectUrl } from 'app/features/provisioning/utils/redirect';

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
 * Shared hook for importing a dashboard into a provisioned (repo-managed) folder.
 *
 * Builds a ResourceForCreate body, dispatches the create-file mutation, and wires
 * navigation on success / error state on failure via useProvisionedRequestHandler.
 *
 * Used by both ImportOverviewV1 and ImportOverviewV2 in provisioned mode.
 */
export function useImportProvisionedSave({ repository }: { repository: RepositoryView }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>();

  // Track per-save form values for the request handler effect.
  // These are updated synchronously in save() before the mutation fires.
  const [workflow, setWorkflow] = useState<string>();
  const [folderUid, setFolderUid] = useState<string>();
  const [selectedBranch, setSelectedBranch] = useState<string>();
  const titleRef = useRef('');

  // Always create (never update) — import is always a new file.
  const [createFile, request] = useCreateOrUpdateRepositoryFile(undefined);

  useProvisionedRequestHandler<unknown>({
    folderUID: folderUid,
    request,
    workflow,
    resourceType: 'dashboard',
    repository,
    selectedBranch,
    handlers: {
      onWriteSuccess: (upsert) => {
        const url = locationUtil.assureBaseUrl(
          getDashboardUrl({
            uid: upsert.metadata.name,
            slug: kbn.slugifyForUrl(titleRef.current),
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
      onError: (err) => {
        setError(
          getProvisionedRequestError(
            err,
            'dashboard',
            t('manage-dashboards.import-provisioned.error', 'An error occurred while importing the dashboard.')
          )
        );
      },
    },
  });

  const save = useCallback(
    ({ spec, apiVersion, uid, folderUid: targetFolderUid, title, form }: ImportProvisionedSaveParams) => {
      setError(undefined);
      setWorkflow(form.workflow);
      setFolderUid(targetFolderUid);
      setSelectedBranch(form.ref);
      titleRef.current = title;

      const resolvedVersion =
        apiVersion === 'v2' ? dashboardAPIVersionResolver.getV2() : dashboardAPIVersionResolver.getV1();

      const body: ResourceForCreate<unknown> = {
        apiVersion: `dashboard.grafana.app/${resolvedVersion}`,
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
        message: form.comment || `Import dashboard: ${title}`,
        body,
      });
    },
    [repository, createFile]
  );

  return { save, isLoading: request.isLoading ?? false, error };
}
