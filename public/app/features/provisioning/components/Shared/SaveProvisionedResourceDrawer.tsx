import { css } from '@emotion/css';
import { customAlphabet } from 'nanoid';
import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Drawer, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import {
  type RepositoryUrLs,
  type RepositoryView,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import {
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';
import { useDispatch } from 'app/types/store';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { useCommitTarget } from '../../hooks/useCommitTarget';
import { useCreateOrUpdateRepositoryFile } from '../../hooks/useCreateOrUpdateRepositoryFile';
import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { useLastBranch } from '../../hooks/useLastBranch';
import { type BaseProvisionedFormData } from '../../types/form';
import { type CommitTemplateVars } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { getManagerIdentity, getSourcePath, type ManagedResource } from '../../utils/managedResource';
import { appendPullRequestTitleParam } from '../../utils/pullRequestTitle';
import { getKindInfoByGroupKind, type ResourceKindInfo } from '../../utils/resourceKinds';
import { getRequestRef } from '../../utils/workflow';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { getCanPushToConfiguredBranch, getDefaultRef } from '../defaults';
import { getProvisionedRequestError } from '../utils/errors';
import { slugifyForFilename } from '../utils/path';

import { ProvisionedCommitSuccess } from './ProvisionedCommitSuccess';
import { ProvisionedDrawerLayout } from './ProvisionedDrawerLayout';
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
  /** Committed verbatim as the file body. */
  spec?: Record<string, unknown>;
};

// New resources need a stable k8s name in the committed file (the provisioning write validates the
// resource has one). Generate an RFC 1123-safe UID.
const generateResourceName = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

/** Builds the repository file path for a new resource from its title, falling back to the kind key. */
function getNewResourcePath(title: string, kindKey: string): string {
  return `${slugifyForFilename(title) || kindKey}.json`;
}

/** The commit that landed, which the drawer's success state renders. */
interface CommitOutcome {
  /** Branch the commit landed on; absent for a direct write to the configured branch. */
  ref?: string;
  urls?: RepositoryUrLs;
  message: string;
  /** Hash the write landed on, as reported by the provisioning API. */
  hash?: string;
  /** Rendered pull-request title, which prefills the provider's "open pull request" form. */
  prTitle: string;
}

interface BaseDrawerProps {
  /**
   * The resource to commit (`create`/`update`) or remove (`delete`). It carries everything the drawer
   * needs: its `apiVersion`+`kind` resolve the {@link ResourceKindInfo} (label, invalidation),
   * its `spec` becomes the committed file, and for an existing resource its `metadata.annotations`
   * resolve the repository.
   */
  resource: ProvisionedResource;
  /**
   * Human-readable title for the commit message and a new resource's file slug. Passed explicitly
   * rather than read from `spec.title` because the title field isn't consistent across kinds (e.g.
   * correlations and teams carry it on `spec.name`); the committed file body still comes from
   * `resource.spec`.
   */
  title: string;
  /** Message shown when the repository can't be edited from the UI. */
  readOnlyMessage?: string;
  /** Prefix for generated branch names. Defaults to the kind's key. */
  branchPrefix?: string;
  /** In-app list page the drawer's "Back to all ..." step returns to. The caller owns its routes. */
  redirectUrl: string;
  onDismiss?: () => void;
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
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  canPushToConfiguredBranch: boolean;
  onCommitted: (outcome: CommitOutcome) => void;
  onDismiss?: () => void;
}

function FormContent({
  kind,
  resourceName,
  title,
  body,
  action,
  isNew,
  initialValues,
  repository,
  canPushToConfiguredBranch,
  onCommitted,
  onDismiss,
}: FormProps) {
  const dispatch = useDispatch();
  const { setLastBranch } = useLastBranch();
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
  const ref = watch('ref') ?? '';

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

  // Branch-name template fill/lock follows from the target branch, as does whether this commit
  // lands directly on the configured branch or opens a pull request.
  const { workflow, isResolving, lockBranch, prTitle } = useCommitTarget({
    repository,
    vars: templateVars,
    ref,
    isRefDirty: Boolean(formState.dirtyFields.ref),
    setRef: (value) => methods.setValue('ref', value, { shouldDirty: false }),
  });
  const isDirectWrite = workflow === 'write';

  const showError = (err: unknown) => {
    setError(getProvisionedRequestError(err, t('provisioning.save-resource.error-saving', 'Failed to save changes')));
  };

  const doSave = async ({ ref, path }: BaseProvisionedFormData) => {
    setError(undefined);
    const repoName = repository?.name;
    // Use the submitted path: for new resources the path field is editable, so the user may have
    // changed it from the initial slug. For existing resources the field is read-only (== initial).

    if (!repoName || !path) {
      showError(t('provisioning.save-resource.missing-info', 'Missing required fields for saving'));
      return;
    }

    const branchRef = getRequestRef(repository, ref);

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

      const landedOn = data.ref || repository?.branch;
      if (landedOn) {
        setLastBranch(repoName, landedOn);
      }
      // The committed change has to show up on the list the drawer's "Next" steps lead back to.
      const invalidateAction = kind.invalidateListTags?.();
      if (invalidateAction) {
        dispatch(invalidateAction);
      }

      onCommitted({ ref: data.ref, urls: data.urls, message, hash: data.hash, prTitle });
    } catch (err) {
      showError(err);
    }
  };

  const primaryLabel = () => {
    if (request.isLoading) {
      return isDelete
        ? t('provisioning.save-resource.button-deleting', 'Deleting...')
        : t('provisioning.save-resource.button-committing', 'Committing...');
    }
    if (isDelete) {
      return t('provisioning.save-resource.button-delete', 'Delete');
    }
    // Naming the branch makes the consequence of a direct commit explicit: it is dual-written, so
    // it is live for everyone immediately, where a branch commit is not.
    return isDirectWrite && repository?.branch
      ? t('provisioning.save-resource.button-commit-to-configured', 'Commit to {{branch}}', {
          branch: repository.branch,
        })
      : t('provisioning.save-resource.button-commit-to-branch', 'Commit to branch');
  };

  return (
    <FormProvider {...methods}>
      <ProvisionedDrawerLayout
        onSubmit={handleSubmit(doSave)}
        footer={
          <>
            <Button
              type="submit"
              variant={isDelete ? 'destructive' : 'primary'}
              disabled={request.isLoading || isResolving}
            >
              {primaryLabel()}
            </Button>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              {t('provisioning.save-resource.button-cancel', 'Cancel')}
            </Button>
          </>
        }
      >
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
        </Stack>
      </ProvisionedDrawerLayout>
    </FormProvider>
  );
}

interface SuccessProps {
  kind: ResourceKindInfo;
  action: ProvisionedResourceAction;
  resourceName: string;
  redirectUrl: string;
  repository?: RepositoryView;
  outcome: CommitOutcome;
}

function SuccessContent({ kind, action, resourceName, redirectUrl, repository, outcome }: SuccessProps) {
  const navigate = useNavigate();
  const isDirect = !outcome.ref;
  const prUrl = appendPullRequestTitleParam(outcome.urls?.newPullRequestURL, repository?.type, outcome.prTitle);

  // Only a direct commit is live in Grafana: a branch commit exists on the branch alone until the
  // pull request merges, so there is nothing to view yet.
  const resourceRoute = action === 'delete' || !isDirect ? undefined : kind.getRoute?.(resourceName);

  return (
    <ProvisionedDrawerLayout
      footer={
        <>
          {/* Opening the pull request is what carries a branch commit forward. */}
          {prUrl && (
            <LinkButton href={prUrl} target="_blank" variant="primary" icon="external-link-alt">
              <Trans i18nKey="provisioning.save-resource.open-pull-request">Open pull request</Trans>
            </LinkButton>
          )}
          {resourceRoute && (
            <Button variant="secondary" onClick={() => navigate(resourceRoute)}>
              {t('provisioning.save-resource.next-view', 'View {{resource}}', { resource: kind.getLabel() })}
            </Button>
          )}
          {/* Closing the drawer is what returns to the editor, so no button repeats it. */}
          <Button variant="secondary" onClick={() => navigate(redirectUrl)}>
            {t('provisioning.save-resource.next-list', 'Back to all {{resources}}', {
              resources: kind.pluralLabel().toLocaleLowerCase(),
            })}
          </Button>
        </>
      }
    >
      <ProvisionedCommitSuccess
        action={action}
        branch={outcome.ref}
        configuredBranch={repository?.branch}
        repoType={repository?.type}
        repoUrl={outcome.urls?.repositoryURL ?? repository?.url}
        commitMessage={outcome.message}
        commitHash={outcome.hash}
        sourceUrl={outcome.urls?.sourceURL}
      />
    </ProvisionedDrawerLayout>
  );
}

/**
 * Drawer for committing a repository-managed resource to git — usable directly from a resource's
 * pages with no per-kind wrapper. Pass the resource, its title and the action: the drawer resolves
 * the kind from the resource's `apiVersion`+`kind` and derives the rest — the committed file body, a
 * new resource's name/path/annotations and the commit message. Once the commit lands the drawer
 * stays open and reports where the change went, so the caller needs no pull-request banner.
 * Renders nothing if the resource isn't a registered provisioning kind (pages only open it for
 * known managed resources).
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
  redirectUrl,
  resource,
  action,
  title,
  repositoryName,
  readOnlyMessage,
  branchPrefix,
  onDismiss,
}: ResourceDrawerContentProps) {
  const styles = useStyles2(getStyles);
  const isNew = action === 'create';
  const isDelete = action === 'delete';
  const [outcome, setOutcome] = useState<CommitOutcome | undefined>(undefined);

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

  const drawerTitle = isDelete
    ? t('provisioning.save-resource.drawer-title-delete', 'Delete provisioned resource')
    : t('provisioning.save-resource.drawer-title-save', 'Save provisioned resource');

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
    };
  }, [repository, isLoading, title, sourcePath, prefix]);

  return (
    <Drawer
      size="sm"
      // The pinned footer keeps the commit action in view, so the drawer manages its own scrolling.
      scrollableContent={false}
      title={drawerTitle}
      subtitle={
        sourcePath ? (
          <span className={styles.path}>{sourcePath}</span>
        ) : (
          <Text variant="bodySmall" color="secondary">
            {title}
          </Text>
        )
      }
      onClose={() => onDismiss?.()}
    >
      {outcome ? (
        <SuccessContent
          kind={kind}
          action={action}
          resourceName={resourceName}
          redirectUrl={redirectUrl}
          repository={repository}
          outcome={outcome}
        />
      ) : (
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
              initialValues={initialValues}
              repository={repository}
              canPushToConfiguredBranch={canPushToConfiguredBranch}
              onCommitted={setOutcome}
              onDismiss={onDismiss}
            />
          )}
        </ProvisionedFormGate>
      )}
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  path: css({
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    wordBreak: 'break-all',
  }),
});
