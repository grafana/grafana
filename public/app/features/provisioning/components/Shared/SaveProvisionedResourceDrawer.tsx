import { css } from '@emotion/css';
import { customAlphabet } from 'nanoid';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom-v5-compat';
import useMountedState from 'react-use/lib/useMountedState';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Stack, Text, useStyles2 } from '@grafana/ui';
import {
  type RepositoryView,
  useDeleteRepositoryFilesWithPathMutation,
  useGetFrontendSettingsQuery,
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
import {
  getKindKeyByGroupKind,
  resourceKindInfos,
  type ResourceKindInfo,
  type ResourceKindKey,
} from '../../utils/resourceKinds';
import { getRequestRef } from '../../utils/workflow';
import { ProvisionedFormGate } from '../ProvisionedFormGate';
import { getCanPushToConfiguredBranch, getDefaultRef } from '../defaults';
import { getProvisionedRequestError } from '../utils/errors';
import { joinPath, slugifyForFilename } from '../utils/path';

import { ProvisionedCommitSteps } from './ProvisionedCommitSteps';
import { ProvisionedCommitSuccess } from './ProvisionedCommitSuccess';
import { ProvisionedDrawerLayout } from './ProvisionedDrawerLayout';
import { RepositorySelect } from './RepositorySelect';
import { ResourceEditFormSharedFields } from './ResourceEditFormSharedFields';
import {
  type ProvisionedCommitOutcome,
  buildCommitOutcome,
  clearStoredCommitOutcome,
  parseStoredCommitOutcome,
  storeCommitOutcome,
} from './provisionedCommitOutcome';

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

export interface SaveProvisionedResourceDrawerProps {
  /**
   * The resource to commit (`create`/`update`) or remove (`delete`). It carries everything the drawer
   * needs: its `apiVersion`+`kind` resolve the {@link ResourceKindInfo} (label, invalidation),
   * its `spec` becomes the committed file, and for an existing resource its `metadata.annotations`
   * resolve the repository.
   */
  resource: ProvisionedResource;
  /**
   * Human-readable title for the drawer subtitle, the commit message and a new resource's file slug.
   * Passed explicitly rather than read from `spec.title` because the title field isn't consistent
   * across kinds (e.g. correlations and teams carry it on `spec.name`); the committed file body still
   * comes from `resource.spec`.
   */
  title: string;
  /** Message shown when the repository can't be edited from the UI. */
  readOnlyMessage?: string;
  /** Prefix for generated branch names. Defaults to the kind's key. */
  branchPrefix?: string;
  directory?: string;
  action: ProvisionedResourceAction;
  repositoryName?: string;
  onDismiss?: (outcome?: ProvisionedCommitOutcome) => void;
}

interface FormProps {
  kindKey?: ResourceKindKey;
  resourceType: string;
  resourceName: string;
  title: string;
  body?: Record<string, unknown>;
  action: ProvisionedResourceAction;
  isNew: boolean;
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  canPushToConfiguredBranch: boolean;
  onCommitted: (outcome: ProvisionedCommitOutcome) => void;
  onDismiss?: () => void;
}

function FormContent({
  kindKey,
  resourceType,
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

  // Branch-name template fill/lock and the PR title follow from the target branch.
  const { workflow, isResolving, lockBranch, prTitle } = useCommitTarget({
    repository,
    vars: templateVars,
    ref,
    isRefDirty: Boolean(formState.dirtyFields.ref),
    setRef: (value) => methods.setValue('ref', value, { shouldDirty: false }),
  });

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
      const kind: ResourceKindInfo | undefined = kindKey && resourceKindInfos[kindKey];
      const invalidateAction = kind?.invalidateListTags?.();
      if (invalidateAction) {
        dispatch(invalidateAction);
      }

      onCommitted(
        buildCommitOutcome({
          action,
          ref: data.ref,
          urls: data.urls,
          message,
          prTitle,
          repository,
          pendingSync: !isDelete && !data.resource?.upsert,
        })
      );
    } catch (err) {
      showError(err);
    }
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
              {isDelete
                ? request.isLoading
                  ? t('provisioning.save-resource.button-deleting', 'Deleting...')
                  : t('provisioning.save-resource.button-delete', 'Delete')
                : request.isLoading
                  ? t('provisioning.save-resource.button-committing', 'Committing...')
                  : t('provisioning.save-resource.button-commit', 'Commit')}
            </Button>
            <Button variant="secondary" fill="outline" onClick={() => onDismiss?.()}>
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
  kindKey?: ResourceKindKey;
  resourceName?: string;
  outcome: ProvisionedCommitOutcome;
  onDismiss?: (outcome: ProvisionedCommitOutcome) => void;
}

interface RepositoryStepProps {
  onSelect: (repositoryName: string) => void;
  onDismiss?: () => void;
}

function RepositoryStep({ onSelect, onDismiss }: RepositoryStepProps) {
  const { data } = useGetFrontendSettingsQuery();
  const [selected, setSelected] = useState('');

  return (
    <ProvisionedDrawerLayout
      onSubmit={(event) => {
        event.preventDefault();
        onSelect(selected);
      }}
      footer={
        <>
          <Button type="submit" disabled={!selected}>
            {t('provisioning.save-resource.button-next', 'Next')}
          </Button>
          <Button variant="secondary" fill="outline" onClick={() => onDismiss?.()}>
            {t('provisioning.save-resource.button-cancel', 'Cancel')}
          </Button>
        </>
      }
    >
      <RepositorySelect
        repositories={data?.items ?? []}
        value={selected}
        onChange={setSelected}
        description={t(
          'provisioning.save-resource.repository-description',
          "The repository to commit this resource to. This can't be changed after the resource is created."
        )}
      />
    </ProvisionedDrawerLayout>
  );
}

function SuccessContent({ kindKey, resourceName, outcome, onDismiss }: SuccessProps) {
  return (
    <ProvisionedDrawerLayout
      footer={
        <ProvisionedCommitSteps
          kindKey={kindKey}
          outcome={outcome}
          resourceName={resourceName}
          onDismiss={() => onDismiss?.(outcome)}
        />
      }
    >
      <ProvisionedCommitSuccess outcome={outcome} />
    </ProvisionedDrawerLayout>
  );
}

function getDrawerTitle(isDelete: boolean) {
  return isDelete
    ? t('provisioning.save-resource.drawer-title-delete', 'Delete provisioned resource')
    : t('provisioning.save-resource.drawer-title-save', 'Save provisioned resource');
}

export function CommitOutcomeDrawer({ stored, onDismiss }: { stored: string; onDismiss: () => void }) {
  const { pathname } = useLocation();
  const parsed = useMemo(() => parseStoredCommitOutcome(stored, pathname), [stored, pathname]);
  const dismiss = () => {
    clearStoredCommitOutcome();
    onDismiss();
  };
  useEffect(() => {
    if (!parsed) {
      clearStoredCommitOutcome();
      onDismiss();
    }
  }, [parsed, onDismiss]);
  if (!parsed) {
    return null;
  }
  return (
    <Drawer
      size="sm"
      scrollableContent={false}
      title={getDrawerTitle(parsed.outcome.action === 'delete')}
      onClose={dismiss}
    >
      <SuccessContent
        kindKey={parsed.kindKey}
        resourceName={parsed.resourceName}
        outcome={parsed.outcome}
        onDismiss={dismiss}
      />
    </Drawer>
  );
}

/**
 * Drawer for committing a repository-managed resource to git — usable directly from a resource's
 * pages with no per-kind wrapper. Pass the resource, its title and the action: the drawer resolves
 * the kind from the resource's `apiVersion`+`kind` and derives the rest — the committed file body, a
 * new resource's name/path/annotations and the commit message. `delete` commits no body. Renders nothing if the resource
 * has no apiVersion or kind.
 */
export function SaveProvisionedResourceDrawer(props: SaveProvisionedResourceDrawerProps) {
  // The resource carries its own identity: its API group (from apiVersion) + Kubernetes kind resolve
  // the registry key, so callers don't pass the kind separately.
  const group = props.resource.apiVersion?.split('/')[0];
  const { kind } = props.resource;
  if (!group || !kind) {
    // Warn in dev so it's a visible signal rather than a silent no-op where the user clicks save/delete
    // and nothing happens.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `SaveProvisionedResourceDrawer: the resource has no apiVersion or kind ("${props.resource.apiVersion}"/"${kind}"); the drawer will not render.`
      );
    }
    return null;
  }
  return (
    <ResourceDrawerContent
      {...props}
      kindKey={getKindKeyByGroupKind(group, kind)}
      resourceType={kind.toLowerCase()}
    />
  );
}

type ResourceDrawerContentProps = SaveProvisionedResourceDrawerProps & {
  kindKey?: ResourceKindKey;
  resourceType: string;
};

function ResourceDrawerContent({
  kindKey,
  resourceType,
  resource,
  action,
  title,
  repositoryName,
  readOnlyMessage,
  branchPrefix,
  directory = '',
  onDismiss,
}: ResourceDrawerContentProps) {
  const styles = useStyles2(getStyles);
  const isNew = action === 'create';
  const isDelete = action === 'delete';
  const [outcome, setOutcome] = useState<ProvisionedCommitOutcome | undefined>(undefined);
  useEffect(() => (outcome ? clearStoredCommitOutcome : undefined), [outcome]);
  const isMounted = useMountedState();
  const [selectedRepository, setSelectedRepository] = useState(repositoryName);

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
            [AnnoKeyManagerIdentity]: selectedRepository ?? '',
            [AnnoKeySourcePath]: joinPath(directory, getNewResourcePath(title, resourceType)),
          },
        },
      }
    : resource;

  // Delete removes the file, so it commits no body; create/update commit the standard resource shape.
  const body = isDelete
    ? undefined
    : { apiVersion: resource.apiVersion, kind: resource.kind, metadata: { name: resourceName }, spec: resource.spec };

  // Branch names can't contain spaces, so prefix from the kind name, not the display noun.
  const prefix = branchPrefix ?? resourceType;
  const { repository, isLoading, isReadOnlyRepo, isMissingRepo } = useGetResourceRepositoryView({
    name: getManagerIdentity(managedResource),
  });
  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);
  const sourcePath = getSourcePath(managedResource);

  const drawerTitle = getDrawerTitle(isDelete);

  const onCommitted = (committed: ProvisionedCommitOutcome) => {
    if (!isMounted()) {
      return;
    }
    setOutcome(committed);
    storeCommitOutcome({ outcome: committed, kindKey, resourceName });
  };

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
      onClose={() => onDismiss?.(outcome)}
    >
      {outcome ? (
        <SuccessContent kindKey={kindKey} resourceName={resourceName} outcome={outcome} onDismiss={onDismiss} />
      ) : isNew && !selectedRepository ? (
        <RepositoryStep onSelect={setSelectedRepository} onDismiss={onDismiss} />
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
              kindKey={kindKey}
              resourceType={resourceType}
              resourceName={resourceName}
              title={title}
              body={body}
              action={action}
              isNew={isNew}
              initialValues={initialValues}
              repository={repository}
              canPushToConfiguredBranch={canPushToConfiguredBranch}
              onCommitted={onCommitted}
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
