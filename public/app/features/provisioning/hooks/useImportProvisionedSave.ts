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

  // Track per-save form values for the request handler effect.
  // Updated synchronously in save() before the mutation fires.
  const [workflow, setWorkflow] = useState<string>();
  const [folderUid, setFolderUid] = useState<string>();
  const [selectedBranch, setSelectedBranch] = useState<string>();
  const titleRef = useRef('');
  const activeRepoRef = useRef<RepositoryView | undefined>();

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
        const repo = activeRepoRef.current;
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
    ({ spec, apiVersion, uid, folderUid: targetFolderUid, title, form }: ImportProvisionedSaveParams) => {
      if (!repository) {
        return;
      }
      activeRepoRef.current = repository;
      setError(undefined);
      setWorkflow(form.workflow);
      setFolderUid(targetFolderUid);
      setSelectedBranch(form.ref);
      titleRef.current = title;

      const resolvedVersion =
        apiVersion === 'v2' ? dashboardAPIVersionResolver.getV2() : dashboardAPIVersionResolver.getV1();

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
        message: form.comment || `Import dashboard: ${title}`,
        body,
      });
    },
    [repository, createFile]
  );

  return { save, isLoading: request.isLoading ?? false, error };
}
