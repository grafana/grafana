import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm, FormProvider } from 'react-hook-form';

import { locationUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Alert, Button, Field, Input, Stack, TextArea, Switch } from '@grafana/ui';
import {
  type RepositoryView,
  type ResourceWrapper,
  type Unstructured,
  useCreateRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { CORE_KINDS } from 'app/core/kinds/coreKinds';
import kbn from 'app/core/utils/kbn';
import { type Resource } from 'app/features/apiserver/types';
import { isPendingChangesStale } from 'app/features/dashboard-scene/lifecycle/pendingChangePreview';
import {
  finishCommittingPendingChanges,
  getCommittedPendingChanges,
} from 'app/features/dashboard-scene/lifecycle/pendingChangesSave';
import { SaveDashboardFormCommonOptions } from 'app/features/dashboard-scene/saving/SaveDashboardForm';
import { nextMetaAfterFolderPick } from 'app/features/dashboard-scene/saving/shared';
import { useParkSaveFormDraft } from 'app/features/dashboard-scene/saving/useParkSaveFormDraft';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { PROVISIONING_PREVIEW_URL } from 'app/features/provisioning/constants';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile';
import {
  type ProvisionedOperationInfo,
  useProvisionedRequestHandler,
} from 'app/features/provisioning/hooks/useProvisionedRequestHandler';
import { type SaveDashboardResponseDTO } from 'app/types/dashboard';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { useCommitTarget } from '../../hooks/useCommitTarget';
import { type ProvisionedDashboardFormData } from '../../types/form';
import { type CommitTemplateVars, getResourceCommitMessage } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { appendPullRequestTitleParam } from '../../utils/pullRequestTitle';
import { buildResourceBranchRedirectUrl } from '../../utils/redirect';
import { getRequestRef } from '../../utils/workflow';
import { ProvisioningAwareFolderPicker } from '../Shared/ProvisioningAwareFolderPicker';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getProvisionedRequestError } from '../utils/errors';
import { validateProvisionedFolderName } from '../utils/folderName';
import { ensureFolderPathTrailingSlash, joinPath, slugifyForFilename, splitPath } from '../utils/path';

import { type SaveProvisionedDashboardProps } from './SaveProvisionedDashboard';

export interface Props extends SaveProvisionedDashboardProps {
  isNew: boolean;
  defaultValues: ProvisionedDashboardFormData;
  canPushToConfiguredBranch: boolean;
  readOnly: boolean;
  repository?: RepositoryView;
  /** The view behind these defaults is held: the picked folder's lookup is still loading or dead-ended, so they describe the previous folder and saving must wait */
  isHeld: boolean;
}

export function SaveProvisionedDashboardForm({
  defaultValues,
  dashboard,
  drawer,
  changeInfo,
  isNew,
  canPushToConfiguredBranch,
  readOnly,
  repository,
  saveAsCopy,
  recoverToNewBranch,
  isHeld,
}: Props) {
  const { isDirty } = dashboard.useState();
  const [error, setError] = useState<string | undefined>(undefined);
  // An update usually has nothing to fill in before the commit: the details step only has content
  // for a new dashboard, a copy, or a change the common options can carry. Without it the step
  // would be an empty screen behind a Next button, so such a save opens on the commit directly.
  const hasDetailsStep =
    isNew ||
    Boolean(saveAsCopy) ||
    (!readOnly &&
      Boolean(changeInfo.hasTimeChanges || changeInfo.hasRefreshChange || changeInfo.hasVariableValueChanges));
  const [step, setStep] = useState<'details' | 'commit'>(hasDetailsStep ? 'details' : 'commit');
  // The title check that gates the commit step is a round trip, so the advance owns its own
  // pending flag rather than borrowing the form's (`trigger` does not raise `isValidating`).
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderError, setFolderError] = useState<string | undefined>(undefined);
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  // Spans the whole create-folder flow, unlike the mutation's isLoading which ends before the selection sync
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const isCreatingFolderRef = useRef(false);
  // Lets an in-flight folder creation know the user backed out, so its result isn't applied after the fact
  const folderCreationCancelledRef = useRef(false);
  // Snapshot of the spec actually committed by the last submit. saveCompleted must
  // baseline against this (not getSaveModel()) so post-save change detection matches
  // what was written — on the update path getSaveModel() would re-include values the
  // save-option toggles omitted.
  const savedSpecRef = useRef<Dashboard | DashboardV2Spec | undefined>(undefined);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const [createFolder] = useCreateRepositoryFilesWithPathMutation();

  const {
    handleSubmit,
    watch,
    control,
    reset,
    register,
    setValue,
    getValues,
    formState: { dirtyFields, isSubmitting, isValidating },
  } = methods;

  const path = watch('path');
  // Whether this commit creates the file (POST) rather than updates it (PUT). Distinct from isNew,
  // which is about the dashboard never having been saved: the recovery branch is cut from the
  // configured branch, so a file that only ever lived on the deleted branch has to be created there.
  const createsFile = isNew || recoverToNewBranch?.fileExistsOnConfiguredBranch === false;
  const originalPath = createsFile ? undefined : defaultValues.path;
  const isRename = Boolean(originalPath && path !== originalPath);

  const [createOrUpdateFile, request] = useCreateOrUpdateRepositoryFile(isRename ? undefined : originalPath);

  // Pending changes the page shows to this dashboard go into the commit, and their plugin discards
  // them once it's made. Someone may have saved the dashboard since they started.
  const pendingChanges = isNew ? undefined : getCommittedPendingChanges(dashboard);
  const stalePendingChanges = pendingChanges ? isPendingChangesStale(pendingChanges.preview) : false;

  // Retargeting to another branch is a committable change on its own. In the recovery flow the new
  // branch is a form default (never dirty), so the flag itself has to enable Save.
  const rawDashboardJSON = dashboard.getRawJsonFromEditor();
  const isDirtyState =
    Boolean(dirtyFields.comment) ||
    Boolean(dirtyFields.path) ||
    Boolean(dirtyFields.ref) ||
    Boolean(recoverToNewBranch) ||
    isDirty ||
    // Pending changes are changes to commit, though the page loaded them.
    Boolean(pendingChanges) ||
    Boolean(rawDashboardJSON);
  const ref = watch('ref') ?? '';
  const isFolderless = repository?.target === 'folderless';
  const title = watch('title');
  const description = watch('description');

  // Clear indefinite save-event suppression on unmount (covers cancel, error, navigation away).
  useEffect(() => {
    return () => {
      dashboardWatcher.clearIgnoreSave();
    };
  }, []);

  // Update the form if default values change. keepDirtyValues so a background refetch
  // (e.g. cache invalidation after creating a folder) doesn't wipe fields the user changed.
  useEffect(() => {
    reset(defaultValues, { keepDirtyValues: true });
    if (!isNew) {
      return;
    }
    // A customised filename survives the reset with the previous folder's prefix; the picked folder owns the directory
    const currentPath = getValues('path');
    const nextPath = joinPath(splitPath(defaultValues.path).directory, splitPath(currentPath).filename);
    if (nextPath !== currentPath) {
      setValue('path', nextPath, { shouldDirty: true });
    }
  }, [defaultValues, reset, isNew, getValues, setValue]);

  useParkSaveFormDraft(drawer, title, description);

  const templateVars: CommitTemplateVars = {
    action: createsFile ? 'create' : 'update',
    resourceKind: 'dashboard',
    resourceID: dashboard.state.meta.uid ?? dashboard.state.meta.k8s?.name ?? '',
    title: title ?? '',
    ...getCurrentCommitUser(),
  };
  const { locked, message } = useCommitMessageTemplate({
    repository,
    vars: templateVars,
    comment: watch('comment') ?? '',
    isCommentDirty: Boolean(dirtyFields.comment),
    setComment: (value) => setValue('comment', value, { shouldDirty: false }),
  });

  const { workflow, isNewBranch, isResolving, lockBranch, prTitle } = useCommitTarget({
    repository,
    vars: templateVars,
    ref,
    isRefDirty: Boolean(dirtyFields.ref),
    setRef: (value) => setValue('ref', value, { shouldDirty: false }),
  });

  // Sync filename from title for new dashboards.
  // dirtyFields.path is false when only setValue() has updated the path (shouldDirty defaults to false),
  // and becomes true when the user manually types in the filename input (Controller onChange marks it dirty).
  // This lets us stop auto-syncing once the user has intentionally customised the filename.
  // `path` is a dep so the sync re-applies after a defaults recompute replaces the filename.
  useEffect(() => {
    if (!isNew || dirtyFields.path) {
      return;
    }
    const slugified = slugifyForFilename(title);
    if (!slugified) {
      return;
    }
    const { directory } = splitPath(path);
    const nextPath = joinPath(directory, `${slugified}.json`);
    if (nextPath !== path) {
      setValue('path', nextPath);
    }
  }, [title, path, isNew, dirtyFields.path, setValue]);

  // The repository is read here, while it still resolves: after the commit a created dashboard is
  // no longer a new save and a branch commit is not in Grafana, so the lookup comes back empty.
  const commitSnapshot = useCallback(
    (wrapper: ResourceWrapper) => ({
      message,
      hash: wrapper.hash,
      sourceUrl: wrapper.urls?.sourceURL,
      prUrl: appendPullRequestTitleParam(wrapper.urls?.newPullRequestURL, repository?.type, prTitle),
      repoUrl: wrapper.urls?.repositoryURL ?? repository?.url,
      configuredBranch: repository?.branch,
      repoType: repository?.type,
    }),
    [message, prTitle, repository?.branch, repository?.type, repository?.url]
  );

  const showError = (error: unknown) => {
    setError(
      getProvisionedRequestError(
        error,
        t('dashboard-scene.save-provisioned-dashboard-form.error-saving', 'An error occurred while saving.')
      )
    );
  };

  const getPreviewUrl = useCallback(
    (ref: string, path: string, repoType?: string) =>
      buildResourceBranchRedirectUrl({
        baseUrl: `${PROVISIONING_PREVIEW_URL}/${defaultValues.repo}/preview/${path}`,
        paramName: 'ref',
        paramValue: ref,
        repoType,
        prTitle,
      }),
    [defaultValues.repo, prTitle]
  );

  const handleDismiss = useCallback(
    async (wrapper: ResourceWrapper, { showSaved }: { showSaved: boolean }) => {
      // Baseline against exactly what was committed. On the update path that is the
      // change-trimmed model; getSaveModel() would re-include values the toggles
      // omitted, so change detection would treat them as already saved until reload.
      const model = savedSpecRef.current ?? dashboard.getSaveModel();
      const resourceData = wrapper.resource.upsert || wrapper.resource.dryRun;
      const saveResponse = createSaveResponseFromResource(resourceData);
      // A new dashboard is committed with the title and description typed into the drawer, which the
      // scene does not have yet. Handing them over makes the scene adopt them, so the re-baselined
      // model matches and leaving the reported commit does not read as an unsaved edit.
      const saveAsSource = isNew
        ? { title: getValues('title'), description: getValues('description'), tags: dashboard.state.tags }
        : undefined;
      // The drawer stays open to report the commit, so the save must not drop it as the overlay.
      await dashboard.saveCompleted(model, saveResponse, defaultValues.folder?.uid, saveAsSource, {
        keepOverlay: true,
      });
      dashboardWatcher.clearIgnoreSave();
      // The commit is the save. A new dashboard committed to a branch is not in Grafana yet, so the
      // re-baselined model cannot match the scene and change detection would keep reading as an
      // unsaved edit; leaving the reported commit must not ask to save it again.
      dashboard.setState({ isDirty: false });
      if (pendingChanges) {
        await finishCommittingPendingChanges(dashboard, pendingChanges, { showSaved });
      }
    },
    [dashboard, defaultValues.folder?.uid, pendingChanges, isNew, getValues]
  );

  const onWriteSuccess = useCallback(
    (upsert: Resource<Dashboard>, wrapper: ResourceWrapper) => {
      // The configured branch is the dashboard here, unless the commit made a new one.
      handleDismiss(wrapper, { showSaved: !isNew && !recoverToNewBranch });

      // The drawer stays open to report the commit, so the panel-edit params are cleared here
      // rather than by navigating away.
      locationService.partial({
        viewPanel: null,
        editPanel: null,
      });

      drawer.setState({
        commitOutcome: {
          ...commitSnapshot(wrapper),
          action: isNew ? 'create' : 'update',
          // Staying on the preview URL would keep showing the deleted branch (and its recovery
          // banner) for a draft that was just saved, so point at the saved dashboard instead.
          viewUrl: upsert?.metadata?.name ? CORE_KINDS.dashboard.getRoute(upsert.metadata.name) : undefined,
        },
      });
    },
    [isNew, recoverToNewBranch, handleDismiss, commitSnapshot, drawer]
  );

  const onBranchSuccess = useCallback(
    (
      ref: string,
      path: string,
      info: ProvisionedOperationInfo,
      upsert: Resource<Dashboard>,
      wrapper: ResourceWrapper
    ) => {
      handleDismiss(wrapper, { showSaved: false });
      drawer.setState({
        commitOutcome: {
          ...commitSnapshot(wrapper),
          action: isNew ? 'create' : 'update',
          branch: ref,
          // Unlike most kinds, a dashboard on a branch is viewable. A new one is reached at its own
          // URL; an existing one needs the preview route to be rendered from that ref rather than
          // from what is on the configured branch.
          viewUrl:
            isNew && upsert?.metadata?.name
              ? CORE_KINDS.dashboard.getRoute(upsert.metadata.name)
              : getPreviewUrl(ref, path, info.repoType),
        },
      });
    },
    [isNew, getPreviewUrl, handleDismiss, commitSnapshot, drawer]
  );
  // Meta is where the drawer resolves the repository from and where the defaults (path, folder) recompute from
  const selectFolder = useCallback(
    (uid?: string, title?: string) => {
      setValue('folder', { uid, title });
      dashboard.setState({ meta: nextMetaAfterFolderPick(dashboard.state.meta, uid, title) });
    },
    [setValue, dashboard]
  );

  const handleCreateFolder = useCallback(async () => {
    if (isCreatingFolderRef.current || isHeld) {
      return;
    }
    setFolderError(undefined);
    const folderName = newFolderName.trim();
    if (!repository?.name) {
      return;
    }
    const validationResult = validateProvisionedFolderName(folderName);
    if (validationResult !== true) {
      setFolderError(validationResult);
      return;
    }
    // Nest the new folder under the currently selected target folder
    const { directory, filename } = splitPath(getValues('path'));
    const folderPath = ensureFolderPathTrailingSlash(joinPath(directory, folderName));
    reportInteraction('grafana_provisioning_folder_create_submitted', {
      workflow: 'write',
      repositoryName: repository.name,
      repositoryType: repository.type ?? 'unknown',
      source: 'save-dashboard',
    });
    isCreatingFolderRef.current = true;
    folderCreationCancelledRef.current = false;
    setIsCreatingFolder(true);
    let uid: string | undefined;
    try {
      const data = await createFolder({
        name: repository.name,
        path: folderPath,
        message: getResourceCommitMessage({
          comment: '',
          repository,
          action: 'create',
          resourceKind: 'folder',
          resourceID: '',
          title: folderName,
          ...getCurrentCommitUser(),
        }),
        body: { title: folderName, type: 'folder' },
      }).unwrap();
      uid = data.resource?.upsert?.metadata?.name;
    } catch (err) {
      isCreatingFolderRef.current = false;
      if (!mountedRef.current) {
        return;
      }
      if (!folderCreationCancelledRef.current) {
        setFolderError(
          getProvisionedRequestError(
            err,
            t('dashboard-scene.save-provisioned-dashboard-form.folder-create-error', 'Failed to create folder')
          )
        );
      }
      setIsCreatingFolder(false);
      return;
    }
    // The folder was already created on the backend; only skip applying its selection if the
    // user backed out of the flow (or the form unmounted) while the commit was in flight
    if (!mountedRef.current) {
      isCreatingFolderRef.current = false;
      return;
    }
    if (!folderCreationCancelledRef.current) {
      if (uid) {
        setValue('path', joinPath(folderPath, filename));
        selectFolder(uid, folderName);
      } else {
        // Sync disabled: no folder resource to select, mark path dirty so resets keep the new location
        setValue('path', joinPath(folderPath, filename), { shouldDirty: true });
      }
      setShowNewFolderForm(false);
      setNewFolderName('');
    }
    isCreatingFolderRef.current = false;
    setIsCreatingFolder(false);
  }, [newFolderName, repository, createFolder, setValue, getValues, selectFolder, isHeld]);

  const { handleSuccess } = useProvisionedRequestHandler<Dashboard>({
    folderUID: defaultValues.folder?.uid,
    resourceType: 'dashboard',
    repository,
    isNewBranch,
    handlers: {
      onBranchSuccess: ({ ref, path }, info, resource, wrapper) => onBranchSuccess(ref, path, info, resource, wrapper),
      onWriteSuccess,
    },
  });

  // Submit handler for saving the form data
  const handleFormSubmit = async ({ title, description, repo, path, copyTags }: ProvisionedDashboardFormData) => {
    setError(undefined);
    // Validate required fields
    if (!repo || !path) {
      showError(
        t('dashboard-scene.save-provisioned-dashboard-form.repo-path-required', 'Missing required fields for saving')
      );
      return;
    }

    const body = rawDashboardJSON
      ? dashboard.getSaveResourceFromSpec(rawDashboardJSON)
      : isNew
        ? dashboard.getSaveResource({
            isNew,
            title,
            description,
            copyTags,
            saveAsCopy,
          })
        : // Existing dashboards: commit the change-trimmed model so the "Change default
          // variables / time range / refresh" toggles are honored. getSaveResource()
          // serializes the full scene and would re-include the current variable values
          // (and time/refresh) even when the toggle is left off, diverging from the diff
          // shown in the drawer. This mirrors the non-provisioned save path. Pending changes have
          // no toggles and go in whole: the model their diff shows leaves out empty values a
          // dashboard needs.
          dashboard.getSaveResourceFromSpec(pendingChanges ? dashboard.getSaveModel() : changeInfo.changedSaveModel);

    // Single source of truth: baseline against exactly the spec we committed, so
    // post-save change detection matches what was written (handleDismiss → saveCompleted).
    // Deriving from body.spec avoids re-running getSaveAsModel() on the new/save-as path.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    savedSpecRef.current = body.spec as Dashboard | DashboardV2Spec;

    reportInteraction('grafana_provisioning_dashboard_save_submitted', {
      workflow,
      repositoryName: repo,
      repositoryType: repository?.type ?? 'unknown',
    });

    // Suppress live save events for the duration of the provisioned save.
    // Git operations can exceed the default 5s ignoreNextSave window.
    dashboardWatcher.ignoreSaveIndefinitely();

    try {
      const data = await createOrUpdateFile({
        ref: getRequestRef(repository, ref),
        name: repo,
        path,
        message,
        body,
        originalPath: isRename ? originalPath : undefined,
      }).unwrap();
      handleSuccess(data);
    } catch (err) {
      // Release suppression so later live save/conflict events from other sessions
      // aren't hidden while the user retries or abandons the save.
      dashboardWatcher.clearIgnoreSave();
      showError(err);
    }
  };

  // Creating a folder from here writes it to the configured branch, which the repository must allow.
  const isDirectWrite = canPushToConfiguredBranch && workflow === 'write';

  // Advancing cannot require a change: comment, path and ref are what usually make the form dirty,
  // and they only exist on the commit step. Only the commit itself needs something to commit.
  const isBlocked = readOnly || isCreatingFolder || isHeld;
  const isPrimaryDisabled =
    step === 'details'
      ? isBlocked || isAdvancing
      : isBlocked || request.isLoading || !isDirtyState || isSubmitting || isValidating || isResolving;

  // Advancing validates what the details step owns, so the commit step is only reached with a
  // dashboard that can actually be committed.
  const goToCommitStep = async () => {
    const detailFields: Array<keyof ProvisionedDashboardFormData> = isNew ? ['title', 'description', 'folder'] : [];
    if (detailFields.length) {
      setIsAdvancing(true);
      try {
        if (!(await methods.trigger(detailFields))) {
          return;
        }
      } finally {
        setIsAdvancing(false);
      }
    }
    setStep('commit');
  };

  const primaryLabel = () => {
    if (step === 'details') {
      // The title is validated before the commit step opens, which can take a round trip.
      return isAdvancing
        ? t('dashboard-scene.save-provisioned-dashboard-form.checking', 'Checking...')
        : t('dashboard-scene.save-provisioned-dashboard-form.next', 'Next');
    }
    if (request.isLoading || isSubmitting || isValidating) {
      return t('dashboard-scene.save-provisioned-dashboard-form.committing', 'Committing...');
    }
    // Committing over someone else's update is the one case the branch name does not describe.
    if (stalePendingChanges) {
      return t('dashboard-scene.save-button.save-and-overwrite', 'Save and overwrite');
    }
    // Naming the branch makes the consequence explicit: a direct commit is dual-written, so it is
    // live for everyone immediately, where a branch commit is not.
    return isDirectWrite && repository?.branch
      ? t('dashboard-scene.save-provisioned-dashboard-form.commit-to-configured', 'Commit to {{branch}}', {
          branch: repository.branch,
        })
      : t('dashboard-scene.save-provisioned-dashboard-form.commit', 'Commit');
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} name="save-provisioned-form">
        <Stack direction="column" gap={2}>
          {readOnly && (
            <RepoInvalidStateBanner
              noRepository={false}
              isReadOnlyRepo={true}
              readOnlyMessage="If you have direct access to the target, copy the JSON and paste it there."
            />
          )}

          {step === 'details' && (
            <Stack direction="column" gap={2}>
              {isNew && (
                <>
                  <Field
                    noMargin
                    label={t('dashboard-scene.save-provisioned-dashboard-form.label-title', 'Title')}
                    invalid={!!methods.formState.errors.title}
                    error={methods.formState.errors.title?.message}
                  >
                    <Input
                      id="dashboard-title"
                      data-testid={selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput}
                      {...register('title', {
                        required: t(
                          'dashboard-scene.save-provisioned-dashboard-form.title-required',
                          'Dashboard title is required'
                        ),
                        validate: validateTitle,
                      })}
                    />
                  </Field>
                  <Field
                    noMargin
                    label={t('dashboard-scene.save-provisioned-dashboard-form.label-description', 'Description')}
                    invalid={!!methods.formState.errors.description}
                    error={methods.formState.errors.description?.message}
                  >
                    <TextArea id="dashboard-description" {...register('description')} />
                  </Field>

                  <Field
                    noMargin
                    label={t('dashboard-scene.save-provisioned-dashboard-form.label-target-folder', 'Target folder')}
                    // The folder is what decides whether this save goes to Git at all, so it says
                    // so here rather than leaving the Next button to imply it.
                    description={
                      repository
                        ? t(
                            'dashboard-scene.save-provisioned-dashboard-form.description-target-folder-synced',
                            'Synced with {{repository}}. Choosing a folder that is not synced saves the dashboard in Grafana instead.',
                            { repository: repository.title || repository.name }
                          )
                        : undefined
                    }
                  >
                    <Controller
                      control={control}
                      name={'folder'}
                      render={({ field: { ref, value, onChange, ...field } }) => {
                        return (
                          <ProvisioningAwareFolderPicker
                            onChange={selectFolder}
                            value={value.uid}
                            {...field}
                            showAllFolders
                          />
                        );
                      }}
                    />
                  </Field>
                  {isFolderless && isDirectWrite && (
                    <>
                      {!showNewFolderForm && (
                        <div>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="plus"
                            onClick={() => {
                              setFolderError(undefined);
                              setShowNewFolderForm(true);
                            }}
                            disabled={isHeld}
                          >
                            <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.new-folder">
                              New folder
                            </Trans>
                          </Button>
                        </div>
                      )}

                      {showNewFolderForm && (
                        <Stack direction="column" gap={1}>
                          <Field
                            noMargin
                            label={t(
                              'dashboard-scene.save-provisioned-dashboard-form.label-folder-name',
                              'Folder name'
                            )}
                          >
                            <Input
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateFolder();
                                }
                              }}
                            />
                          </Field>
                          {folderError && <ProvisioningAlert error={folderError} />}
                          <Stack gap={1}>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={isCreatingFolder ? 'spinner' : undefined}
                              onClick={handleCreateFolder}
                              disabled={!newFolderName || isCreatingFolder || isHeld}
                            >
                              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.create-folder">
                                Create
                              </Trans>
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              fill="outline"
                              onClick={() => {
                                folderCreationCancelledRef.current = true;
                                setShowNewFolderForm(false);
                                setNewFolderName('');
                                setFolderError(undefined);
                              }}
                            >
                              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cancel-folder">
                                Cancel
                              </Trans>
                            </Button>
                          </Stack>
                        </Stack>
                      )}
                    </>
                  )}
                </>
              )}

              {!isNew && !readOnly && <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />}

              {saveAsCopy && (
                <Field noMargin label={t('dashboard-scene.save-dashboard-as-form.label-copy-tags', 'Copy tags')}>
                  <Switch {...register('copyTags')} />
                </Field>
              )}
            </Stack>
          )}

          {step === 'commit' && (
            <Stack direction="column" gap={2}>
              <ResourceEditFormSharedFields
                resourceType="dashboard"
                readOnly={readOnly}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                isNew={isNew}
                allowPathEdit={!isNew && !readOnly}
                lockComment={locked}
                commitMessage={message}
                lockBranch={lockBranch}
                // A new dashboard picks its destination with the Target folder on the details step,
                // which is what sets the repository directory; asking again here would ask twice.
                hiddenFields={isNew ? ['folder'] : undefined}
              />

              {error && <ProvisioningAlert error={error} />}
            </Stack>
          )}

          {stalePendingChanges && (
            <Alert
              title={t(
                'dashboard-scene.save-dashboard-form.render-footer.title-someone-else-has-updated-this-dashboard',
                'Someone else has updated this dashboard'
              )}
              severity="error"
            >
              <Stack direction="column" alignItems="flex-start">
                <Trans i18nKey="dashboard-scene.save-dashboard-form.render-footer.would-still-dashboard">
                  Would you still like to save this dashboard?
                </Trans>
                {pendingChanges?.preview.pending.update && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      drawer.onClose();
                      pendingChanges.preview.pending.update?.();
                    }}
                  >
                    <Trans i18nKey="dashboard-scene.lifecycle.ask-assistant-to-update">Ask Assistant to update</Trans>
                  </Button>
                )}
              </Stack>
            </Alert>
          )}

          <Stack gap={2}>
            <Button
              variant={stalePendingChanges ? 'destructive' : 'primary'}
              type={step === 'commit' ? 'submit' : 'button'}
              onClick={step === 'details' ? goToCommitStep : undefined}
              data-testid={selectors.components.Drawer.DashboardSaveDrawer.saveButton}
              disabled={isPrimaryDisabled}
            >
              {primaryLabel()}
            </Button>
            {step === 'commit' && hasDetailsStep ? (
              <Button variant="secondary" fill="outline" icon="angle-left" onClick={() => setStep('details')}>
                <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.back-to-details">Back to details</Trans>
              </Button>
            ) : (
              <Button variant="secondary" onClick={drawer.onClose} fill="outline">
                <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cancel">Cancel</Trans>
              </Button>
            )}
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

/**
 * Dashboard title validation to ensure it's not the same as the folder name
 * and meets other naming requirements.
 */
async function validateTitle(title: string, formValues: ProvisionedDashboardFormData) {
  if (title === formValues.folder.title?.trim()) {
    return t(
      'dashboard-scene.save-provisioned-dashboard-form.title-same-as-folder',
      'Dashboard name cannot be the same as the folder name'
    );
  }
  try {
    await validationSrv.validateNewDashboardName(formValues.folder.uid ?? 'general', title);
    return true;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : t(
          'dashboard-scene.save-provisioned-dashboard-form.title-validation-failed',
          'Dashboard title validation failed.'
        );
  }
}

/**
 * Creates a SaveDashboardResponseDTO from a provisioning resource response
 * This allows us to use the standard dashboard save completion flow
 */
function createSaveResponseFromResource(resource?: Unstructured): SaveDashboardResponseDTO {
  const uid = resource?.metadata?.name;
  const title = resource?.spec?.title;
  const slug = kbn.slugifyForUrl(title);

  return {
    uid,
    // Use the current dashboard state version to maintain consistency
    version: resource?.metadata?.generation,
    status: 'success',
    url: locationUtil.assureBaseUrl(
      getDashboardUrl({
        uid,
        slug,
        currentQueryParams: '',
      })
    ),
    slug,
  };
}
