import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Stack, Text } from '@grafana/ui';
import { type RepositoryView, useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { useCreateOrUpdateRepositoryFile } from '../../hooks/useCreateOrUpdateRepositoryFile';
import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { type BaseProvisionedFormData } from '../../types/form';
import { type CommitAction, type CommitResourceKind, type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getManagerIdentity, getSourcePath, type ManagedResource } from '../../utils/managedResource';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { getCanPushToConfiguredBranch, getDefaultRef, getDefaultWorkflow } from '../defaults';
import { getProvisionedRequestError } from '../utils/errors';

import { ResourceEditFormSharedFields } from './ResourceEditFormSharedFields';

export interface SaveProvisionedResourceDrawerProps {
  /** Any k8s-style resource exposing `metadata.annotations`; resolves the managing repository and source path. */
  resource: ManagedResource;
  /** Resource type used for the shared fields, request handling and commit message. */
  resourceType: CommitResourceKind;
  /** Stable resource identifier (metadata.name) recorded in the commit message. */
  resourceName: string;
  /** Human-readable title used in the commit message and as the drawer subtitle. */
  title: string;
  /** The file content committed to the repository. Not required when `action` is `delete`. */
  body?: Record<string, unknown>;
  /** Header shown at the top of the drawer (e.g. "Save provisioned playlist"). */
  drawerTitle: string;
  /** Commit action recorded in the commit message. Defaults to `update`. `delete` removes the file. */
  action?: CommitAction;
  /**
   * Whether this commits a brand-new file to the repository (create) rather than replacing an
   * existing one (update). When true the path field becomes editable and the create mutation is
   * used. The managing repository and initial path are still resolved from the resource's
   * annotations, so callers creating a new resource must synthesise them for the chosen repository.
   */
  isNew?: boolean;
  /** Prefix for generated branch names. Defaults to the `resourceType`. */
  branchPrefix?: string;
  /** Notification shown on a successful write to the configured branch. */
  successMessage?: string;
  /** Message shown when the repository can't be edited from the UI. */
  readOnlyMessage?: string;
  onDismiss?: () => void;
  /** Called after a successful write to the configured branch (e.g. navigate / invalidate caches). */
  onWriteSuccess?: () => void;
  /** Called after a successful push to a non-configured branch (PR workflow). */
  onBranchSuccess?: (data: { ref: string; urls?: Record<string, string>; repoType?: string }) => void;
}

interface FormProps extends SaveProvisionedResourceDrawerProps {
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
  isNew = false,
  successMessage,
  initialValues,
  repository,
  canPushToConfiguredBranch,
  onDismiss,
  onWriteSuccess,
  onBranchSuccess,
}: FormProps) {
  const [error, setError] = useState<string | undefined>(undefined);
  const isDelete = action === 'delete';
  // New resources are POSTed (create), existing ones PUT (replace). The wrapper keys off the
  // original path: passing it selects update, omitting it selects create.
  const [saveFile, saveRequest] = useCreateOrUpdateRepositoryFile(isNew ? undefined : initialValues.path);
  const [deleteFile, deleteRequest] = useDeleteRepositoryFilesWithPathMutation();
  const request = isDelete ? deleteRequest : saveRequest;

  const methods = useForm<BaseProvisionedFormData>({ defaultValues: initialValues, mode: 'onBlur' });
  const { handleSubmit, watch, formState } = methods;
  const [workflow] = watch(['workflow']);

  const templateVars: CommitTemplateVars = {
    action,
    resourceKind: resourceType,
    resourceID: resourceName,
    title,
    ...getCurrentCommitUser(),
  };
  const { locked, message } = useCommitMessageTemplate({
    repository,
    vars: templateVars,
    comment: watch('comment') ?? '',
    isCommentDirty: Boolean(formState.dirtyFields.comment),
    setComment: (value) => methods.setValue('comment', value, { shouldDirty: false }),
  });

  const showError = (err: unknown) => {
    setError(getProvisionedRequestError(err, t('provisioning.save-resource.error-saving', 'Failed to save changes')));
  };

  const { handleSuccess } = useProvisionedRequestHandler({
    workflow,
    resourceType,
    repository,
    successMessage,
    handlers: {
      onDismiss,
      onWriteSuccess: () => onWriteSuccess?.(),
      // Branch (PR) workflow: forward to the caller so it can navigate and surface the PR banner on
      // the destination page (like dashboards), passing the repo type for the banner copy.
      onBranchSuccess: ({ ref, urls }) => onBranchSuccess?.({ ref, urls, repoType: repository?.type }),
    },
  });

  const doSave = async ({ ref, workflow }: BaseProvisionedFormData) => {
    setError(undefined);
    const repoName = repository?.name;
    const path = initialValues.path;

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

    try {
      const data = isDelete
        ? await deleteFile({ name: repoName, path, ref: branchRef, message }).unwrap()
        : await saveFile({ name: repoName, path, ref: branchRef, message, body: body ?? {} }).unwrap();
      handleSuccess(data, { workflow, selectedBranch: ref });
    } catch (err) {
      showError(err);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(doSave)}>
        <Stack direction="column" gap={2}>
          <ResourceEditFormSharedFields
            resourceType={resourceType}
            isNew={isNew}
            canPushToConfiguredBranch={canPushToConfiguredBranch}
            repository={repository}
            lockComment={locked}
            commitMessage={message}
          />

          {error && <ProvisioningAlert error={error} />}

          <Stack gap={2}>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              {t('provisioning.save-resource.button-cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant={isDelete ? 'destructive' : 'primary'} disabled={request.isLoading}>
              {isDelete
                ? request.isLoading
                  ? t('provisioning.save-resource.button-deleting', 'Deleting...')
                  : t('provisioning.save-resource.button-delete', 'Delete')
                : request.isLoading
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
 * Drawer for committing a repository-managed resource to git, reusable across the provisioned
 * resource kinds in {@link CommitResourceKind}.
 *
 * Owns the complete drawer (header + branch/path/comment fields + replace-file mutation + request
 * handling): callers supply the resource type, the file `body` to commit, a `drawerTitle`, and
 * success handlers (navigation / cache invalidation). The managing repository and source path are
 * resolved from the resource's annotations. New resource kinds can reuse it once they're added to
 * `CommitResourceKind` (and the shared fields / request handler, which key off the same type).
 */
export function SaveProvisionedResourceDrawer(props: SaveProvisionedResourceDrawerProps) {
  const { resource, resourceType, title, drawerTitle, readOnlyMessage, onDismiss } = props;
  const branchPrefix = props.branchPrefix ?? resourceType;

  const { repository, isLoading, isReadOnlyRepo, isMissingRepo } = useGetResourceRepositoryView({
    name: getManagerIdentity(resource),
  });
  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);
  const sourcePath = getSourcePath(resource);

  const initialValues = useMemo<BaseProvisionedFormData | undefined>(() => {
    if (!repository || isLoading) {
      return undefined;
    }
    return {
      title: title || '',
      comment: '',
      ref: getDefaultRef(repository, branchPrefix),
      repo: repository.name || '',
      path: sourcePath || '',
      workflow: getDefaultWorkflow(repository),
    };
  }, [repository, isLoading, title, sourcePath, branchPrefix]);

  return (
    <Drawer
      title={
        <Text variant="h3" element="h2">
          {drawerTitle}
        </Text>
      }
      subtitle={title}
      onClose={() => onDismiss?.()}
    >
      <ProvisionedFormGate
        isLoading={isLoading}
        isMissingRepo={isMissingRepo}
        isReadOnly={isReadOnlyRepo}
        readOnlyMessage={
          readOnlyMessage ??
          t(
            'provisioning.save-resource.read-only-message',
            'To edit this resource, please update it in your repository directly.'
          )
        }
      >
        {initialValues && (
          <FormContent
            {...props}
            initialValues={initialValues}
            repository={repository}
            canPushToConfiguredBranch={canPushToConfiguredBranch}
          />
        )}
      </ProvisionedFormGate>
    </Drawer>
  );
}
