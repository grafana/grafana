import { customAlphabet } from 'nanoid';
import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Stack, Text } from '@grafana/ui';
import { type RepositoryView, useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import {
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useBranchTemplate } from '../../hooks/useBranchTemplate';
import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { useCreateOrUpdateRepositoryFile } from '../../hooks/useCreateOrUpdateRepositoryFile';
import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { useProvisionedResourceDrawerHandlers } from '../../hooks/useProvisionedResourceDrawerHandlers';
import { usePullRequestTitle } from '../../hooks/usePullRequestTitle';
import { type BaseProvisionedFormData } from '../../types/form';
import { type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getManagerIdentity, getSourcePath, type ManagedResource } from '../../utils/managedResource';
import { type ResourceBranchAction } from '../../utils/redirect';
import { getKindInfoByGroupKind, type ResourceKindInfo } from '../../utils/resourceKinds';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { getCanPushToConfiguredBranch, getDefaultRef, getDefaultWorkflow } from '../defaults';
import { getProvisionedRequestError } from '../utils/errors';
import { slugifyForFilename } from '../utils/path';

import { ResourceEditFormSharedFields } from './ResourceEditFormSharedFields';

/** Commit action handled by this drawer. */
type ProvisionedResourceAction = 'create' | 'update' | 'delete';

/**
 * A k8s-style resource committed via provisioning: `apiVersion`/`kind`/`spec` become the committed
 * file and `metadata` carries the name plus, for existing resources, the manager annotations that
 * resolve the repository. Any generated client's resource (Playlist, LibraryPanel, ...) fits this.
 */
type ProvisionedResource = ManagedResource & {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string };
  /** Committed verbatim as the file body. `title` (when present) also drives the drawer title and new-file slug. */
  spec?: Record<string, unknown> & { title?: string };
};

// New resources need a stable k8s name in the committed file (the provisioning write validates the
// resource has one). Generate an RFC 1123-safe UID.
const generateResourceName = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

/** Builds the repository file path for a new resource from its title, falling back to the kind key. */
function getNewResourcePath(title: string, kindKey: string): string {
  return `${slugifyForFilename(title) || kindKey}.json`;
}

interface BaseDrawerProps {
  /**
   * The resource to commit (`create`/`update`) or remove (`delete`). It carries everything the drawer
   * needs: its `apiVersion`+`kind` resolve the {@link ResourceKindInfo} (title, routes, invalidation),
   * its `spec` becomes the committed file (and `spec.title` the title), and for an existing resource
   * its `metadata.annotations` resolve the repository.
   */
  resource: ProvisionedResource;
  /** Notification shown on a successful write to the configured branch. */
  successMessage?: string;
  /** Message shown when the repository can't be edited from the UI. */
  readOnlyMessage?: string;
  /** Prefix for generated branch names. Defaults to the kind's key. */
  branchPrefix?: string;
  onDismiss?: () => void;
  /** Override the default post-commit (configured-branch) navigation to the kind's list page. */
  onWriteSuccess?: () => void;
  /** Override the default post-push (PR workflow) navigation to the kind's list page. */
  onBranchSuccess?: (data: {
    ref: string;
    urls?: Record<string, string>;
    repoType?: string;
    /** The repository's configured (default) branch, for the PR banner's branch display. */
    configuredBranch?: string;
    /** The repository's base URL, for the PR banner's branch links. */
    repoUrl?: string;
    /** The rendered pull-request title, forwarded as the `pr_title` query param for the PR banner. */
    prTitle?: string;
  }) => void;
}

/**
 * `action` + `repositoryName` are a discriminated union: `create` requires a `repositoryName` (a new
 * resource has no manager annotations yet, so they're synthesised for the chosen repository), while
 * `update`/`delete` resolve the repository from the existing resource's annotations and take none.
 */
export type SaveProvisionedResourceDrawerProps = BaseDrawerProps &
  ({ action: 'create'; repositoryName: string } | { action: 'update' | 'delete'; repositoryName?: never });

interface FormProps {
  kind: ResourceKindInfo;
  resourceName: string;
  title: string;
  body?: Record<string, unknown>;
  action: ProvisionedResourceAction;
  isNew: boolean;
  successMessage?: string;
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  canPushToConfiguredBranch: boolean;
  onDismiss?: () => void;
  onWriteSuccess?: () => void;
  onBranchSuccess?: SaveProvisionedResourceDrawerProps['onBranchSuccess'];
}

function FormContent({
  kind,
  resourceName,
  title,
  body,
  action,
  isNew,
  successMessage,
  initialValues,
  repository,
  canPushToConfiguredBranch,
  onDismiss,
  onWriteSuccess,
  onBranchSuccess,
}: FormProps) {
  const [error, setError] = useState<string | undefined>(undefined);
  // The kind's stable key is the UI-facing resource type for the commit message, telemetry and fields.
  const resourceType = kind.key;
  const isDelete = action === 'delete';
  // New resources are POSTed (create), existing ones PUT (replace). The wrapper keys off the
  // original path: passing it selects update, omitting it selects create.
  const [saveFile, saveRequest] = useCreateOrUpdateRepositoryFile(isNew ? undefined : initialValues.path);
  const [deleteFile, deleteRequest] = useDeleteRepositoryFilesWithPathMutation();
  const request = isDelete ? deleteRequest : saveRequest;

  const methods = useForm<BaseProvisionedFormData>({ defaultValues: initialValues, mode: 'onBlur' });
  const { handleSubmit, watch, formState } = methods;
  const [workflow] = watch(['workflow']);

  // Default the success handlers to the kind's list navigation (invalidate + navigate); a caller can
  // override either. `create`/`update`/`delete` differ only by the PR-banner action param.
  const { goToList, makeOnBranchSuccess } = useProvisionedResourceDrawerHandlers(kind);
  const branchAction: ResourceBranchAction = isDelete ? 'delete' : isNew ? 'create' : 'update';
  const writeSuccess = onWriteSuccess ?? goToList;
  const branchSuccess = onBranchSuccess ?? makeOnBranchSuccess(branchAction);

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

  // Branch (PR) workflow: pre-fill the branch from the repository's name template and lock the field
  // when the repository enforces it; render the PR title from the title template for the PR banner.
  const { locked: lockBranch } = useBranchTemplate({
    repository,
    vars: templateVars,
    workflow,
    value: watch('ref') ?? '',
    setBranch: (value) => methods.setValue('ref', value, { shouldDirty: false }),
  });
  const { prTitle } = usePullRequestTitle({ repository, vars: templateVars, workflow });

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
      onWriteSuccess: () => writeSuccess(),
      // Branch (PR) workflow: pass the repo info so the destination page can render the PR banner.
      onBranchSuccess: ({ ref, urls }) =>
        branchSuccess({
          ref,
          urls,
          repoType: repository?.type,
          configuredBranch: repository?.branch,
          repoUrl: repository?.url,
          prTitle,
        }),
    },
  });

  const doSave = async ({ ref, workflow, path }: BaseProvisionedFormData) => {
    setError(undefined);
    const repoName = repository?.name;
    // Use the submitted path: for new resources the path field is editable, so the user may have
    // changed it from the initial slug. For existing resources the field is read-only (== initial).

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
            lockBranch={lockBranch}
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
 * Drawer for committing a repository-managed resource to git — usable directly from a resource's
 * pages with no per-kind wrapper and no `kind`/`title` props. Pass the resource and the action: the
 * drawer resolves the kind from the resource's `apiVersion`+`kind` and derives the rest — the title
 * from `spec.title`, the committed file body, a new resource's name/path/annotations, the commit
 * message and the post-commit navigation. `delete` commits no body. Renders nothing if the resource
 * isn't a registered provisioning kind (pages only open it for known managed resources).
 */
export function SaveProvisionedResourceDrawer(props: SaveProvisionedResourceDrawerProps) {
  // The resource carries its own identity: its API group (from apiVersion) + Kubernetes kind resolve
  // the registry descriptor, so callers don't pass the kind separately.
  const kind = getKindInfoByGroupKind(props.resource.apiVersion?.split('/')[0], props.resource.kind);
  if (!kind) {
    // Pages only open this for known managed resources, so an unresolved kind means a bad fixture or a
    // new kind wired into a page before its registry entry exists. Warn in dev so it's a visible signal
    // rather than a silent no-op where the user clicks save/delete and nothing happens.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `SaveProvisionedResourceDrawer: no registered provisioning kind for "${props.resource.apiVersion}"/"${props.resource.kind}"; the drawer will not render.`
      );
    }
    return null;
  }
  return <ResourceDrawerContent {...props} kind={kind} />;
}

type ResourceDrawerContentProps = SaveProvisionedResourceDrawerProps & { kind: ResourceKindInfo };

function ResourceDrawerContent({
  kind,
  resource,
  action,
  repositoryName,
  successMessage,
  readOnlyMessage,
  branchPrefix,
  onDismiss,
  onWriteSuccess,
  onBranchSuccess,
}: ResourceDrawerContentProps) {
  const isNew = action === 'create';
  const isDelete = action === 'delete';
  // Title for the commit message, drawer subtitle and (for a new resource) the file slug.
  const title = resource.spec?.title ?? '';

  // A new resource needs a name; generate one once for the lifetime of the drawer as a fallback.
  const generatedName = useMemo(() => generateResourceName(), []);
  // Prefer the resource's own name when it has one; only fall back to a generated name for a new
  // resource that doesn't (the provisioning write requires a name in the committed file).
  const resourceName = resource.metadata?.name || (isNew ? generatedName : '');

  // A new resource has no manager annotations yet, so synthesise them for the chosen repository: the
  // drawer resolves the managing repository and the initial file path from these. An existing
  // repository-managed resource already carries them.
  const managedResource: ManagedResource = isNew
    ? {
        metadata: {
          annotations: {
            [AnnoKeyManagerKind]: ManagerKind.Repo,
            [AnnoKeyManagerIdentity]: repositoryName ?? '',
            [AnnoKeySourcePath]: getNewResourcePath(title, kind.key),
          },
        },
      }
    : resource;

  // Delete removes the file, so it commits no body; create/update commit the standard resource shape.
  const body = isDelete
    ? undefined
    : { apiVersion: resource.apiVersion, kind: resource.kind, metadata: { name: resourceName }, spec: resource.spec };

  // Branch names can't contain spaces, so prefix from the stable `key`, not the display noun.
  const prefix = branchPrefix ?? kind.key;
  const { repository, isLoading, isReadOnlyRepo, isMissingRepo } = useGetResourceRepositoryView({
    name: getManagerIdentity(managedResource),
  });
  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);
  const sourcePath = getSourcePath(managedResource);

  // Title combines a shared translated template with the kind's translated noun (interpolated, so
  // translators control word order), instead of a per-kind "Save/Delete provisioned <kind>" string.
  const resourceLabel = kind.getLabel();
  const drawerTitle = isDelete
    ? t('provisioning.save-resource.drawer-title-delete', 'Delete provisioned {{resource}}', {
        resource: resourceLabel,
      })
    : t('provisioning.save-resource.drawer-title-save', 'Save provisioned {{resource}}', { resource: resourceLabel });

  const initialValues = useMemo<BaseProvisionedFormData | undefined>(() => {
    if (!repository || isLoading) {
      return undefined;
    }
    return {
      title: title || '',
      comment: '',
      ref: getDefaultRef(repository, prefix),
      repo: repository.name || '',
      path: sourcePath || '',
      workflow: getDefaultWorkflow(repository),
    };
  }, [repository, isLoading, title, sourcePath, prefix]);

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
            kind={kind}
            resourceName={resourceName}
            title={title}
            body={body}
            action={action}
            isNew={isNew}
            successMessage={successMessage}
            initialValues={initialValues}
            repository={repository}
            canPushToConfiguredBranch={canPushToConfiguredBranch}
            onDismiss={onDismiss}
            onWriteSuccess={onWriteSuccess}
            onBranchSuccess={onBranchSuccess}
          />
        )}
      </ProvisionedFormGate>
    </Drawer>
  );
}
