import { createElement, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { type RepositoryView, useReplaceRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { type ManagedResource } from 'app/features/provisioning/utils/managedResource';
import { useDispatch } from 'app/types/store';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { PushSuccessMessage } from '../../hooks/PushSuccessMessage';
import { useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { useProvisionedResourceData } from '../../hooks/useProvisionedResourceData';
import { type BaseProvisionedFormData } from '../../types/form';
import { type ProvisionedResourceType } from '../../types/resource';
import { type CommitAction, getSingleResourceCommitMessage } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getProvisionedRequestError } from '../utils/errors';

import { RepoInvalidStateBanner } from './RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from './ResourceEditFormSharedFields';

export interface SaveProvisionedResourceFormProps {
  /** Any k8s-style resource exposing `metadata.annotations`; resolves the managing repository and source path. */
  resource: ManagedResource;
  /** Resource type used for shared fields, request handling, commit messages and error copy. */
  resourceType: ProvisionedResourceType;
  /** Stable resource identifier (metadata.name) recorded in the commit message. */
  resourceName: string;
  /** Human-readable title used in the commit message. */
  title: string;
  /** The file content committed to the repository. */
  body: Record<string, unknown>;
  /** Commit action recorded in the commit message. Defaults to `update`. */
  action?: CommitAction;
  branchPrefix?: string;
  /** Notification shown on a successful write to the configured branch. */
  successMessage?: string;
  /** Fallback error message used when the request fails. */
  errorMessage?: string;
  /** Message shown when the repository can't be edited from the UI. */
  readOnlyMessage?: string;
  onDismiss?: () => void;
  /** Called after a successful write to the configured branch (e.g. navigate / invalidate caches). */
  onWriteSuccess?: () => void;
  /** Called after a successful push to a non-configured branch (PR workflow). */
  onBranchSuccess?: (data: { ref: string; urls?: Record<string, string> }) => void;
}

interface FormContentProps extends SaveProvisionedResourceFormProps {
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  canPushToConfiguredBranch: boolean;
}

function FormContent({
  resourceType,
  resourceName,
  title,
  body,
  action = 'update',
  successMessage,
  errorMessage,
  initialValues,
  repository,
  canPushToConfiguredBranch,
  onDismiss,
  onWriteSuccess,
  onBranchSuccess,
}: FormContentProps) {
  const dispatch = useDispatch();
  const [error, setError] = useState<string | undefined>(undefined);
  const [replaceFile, request] = useReplaceRepositoryFilesWithPathMutation();

  const methods = useForm<BaseProvisionedFormData>({
    defaultValues: initialValues,
    mode: 'onBlur',
  });
  const { handleSubmit, watch } = methods;
  const [ref, workflow] = watch(['ref', 'workflow']);

  const showError = (err: unknown) => {
    setError(
      getProvisionedRequestError(
        err,
        errorMessage ?? t('provisioning.save-resource.error-saving', 'Failed to save changes')
      )
    );
  };

  const handleBranchSuccess = ({ ref: branchRef, urls }: { ref: string; urls?: Record<string, string> }) => {
    // The request handler suppresses its own notification for the branch workflow (it expects a
    // preview page). Resources without a preview page surface the branch/PR link here instead.
    const linkUrl = urls?.newPullRequestURL ?? repository?.url;
    dispatch(
      notifyApp(
        createSuccessNotification(
          '',
          '',
          undefined,
          createElement(PushSuccessMessage, { branch: branchRef, url: linkUrl })
        )
      )
    );
    onBranchSuccess?.({ ref: branchRef, urls });
  };

  useProvisionedRequestHandler({
    request,
    workflow,
    resourceType,
    repository,
    selectedBranch: ref,
    successMessage,
    handlers: {
      onDismiss,
      onWriteSuccess: () => onWriteSuccess?.(),
      onBranchSuccess: ({ ref: branchRef, urls }) => handleBranchSuccess({ ref: branchRef, urls }),
      onError: showError,
    },
  });

  const doSave = async ({ ref, workflow, comment, path }: BaseProvisionedFormData) => {
    setError(undefined);
    const repoName = repository?.name;

    if (!repoName || !path) {
      showError(t('provisioning.save-resource.missing-info', 'Missing required fields for saving'));
      return;
    }

    // For the write workflow we commit to the configured branch; otherwise use the selected branch.
    const branchRef = workflow === 'write' ? undefined : ref;

    reportInteraction('grafana_provisioning_resource_save_submitted', {
      resourceType,
      workflow,
      repositoryName: repoName,
      repositoryType: repository?.type ?? 'unknown',
    });

    // Success/error handling is done by useProvisionedRequestHandler via the `request` object.
    replaceFile({
      name: repoName,
      path,
      ref: branchRef,
      message: getSingleResourceCommitMessage({
        comment,
        repository,
        action,
        resourceKind: resourceType,
        resourceID: resourceName,
        title,
        ...getCurrentCommitUser(),
      }),
      body,
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(doSave)}>
        <Stack direction="column" gap={2}>
          <ResourceEditFormSharedFields
            resourceType={resourceType}
            isNew={false}
            canPushToConfiguredBranch={canPushToConfiguredBranch}
            repository={repository}
          />

          {error && <ProvisioningAlert error={error} />}

          <Stack gap={2}>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              {t('provisioning.save-resource.button-cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={request.isLoading}>
              {request.isLoading
                ? t('provisioning.save-resource.button-saving', 'Saving...')
                : t('provisioning.save-resource.button-save', 'Save')}
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

/**
 * Reusable form for committing a repository-managed resource to git.
 *
 * Resolves the managing repository from the resource's annotations, then renders the shared
 * provisioning fields (branch / path / comment) plus save/cancel buttons, and wires up the
 * replace-file mutation, commit message and request handling. It is resource-agnostic: callers
 * supply the resource type, the file `body` to commit and success handlers (navigation / cache
 * invalidation).
 *
 * Render it directly to embed in any container, or use {@link SaveProvisionedResourceDrawer} to get
 * the standard drawer chrome. Used by playlists today; library panels and other k8s-style resources
 * can reuse it as-is.
 */
export function SaveProvisionedResourceForm(props: SaveProvisionedResourceFormProps) {
  const { repository, initialValues, isReadOnlyRepo, canPushToConfiguredBranch } = useProvisionedResourceData({
    resource: props.resource,
    title: props.title,
    branchPrefix: props.branchPrefix,
  });

  if (isReadOnlyRepo || !initialValues) {
    return (
      <RepoInvalidStateBanner
        noRepository={!initialValues}
        isReadOnlyRepo={isReadOnlyRepo}
        readOnlyMessage={
          props.readOnlyMessage ??
          t(
            'provisioning.save-resource.read-only-message',
            'To edit this resource, please update it in your repository directly.'
          )
        }
      />
    );
  }

  return (
    <FormContent
      {...props}
      initialValues={initialValues}
      repository={repository}
      canPushToConfiguredBranch={canPushToConfiguredBranch}
    />
  );
}
