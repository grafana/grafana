import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Button, Field, Input, Stack, TextArea, Switch } from '@grafana/ui';
import {
  type RepositoryView,
  type ResourceWrapper,
  type Unstructured,
  useCreateRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import kbn from 'app/core/utils/kbn';
import { type Resource } from 'app/features/apiserver/types';
import { SaveDashboardFormCommonOptions } from 'app/features/dashboard-scene/saving/SaveDashboardForm';
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
import { useBranchTemplate } from '../../hooks/useBranchTemplate';
import { useCommitMessageTemplate } from '../../hooks/useCommitMessageTemplate';
import { usePullRequestTitle } from '../../hooks/usePullRequestTitle';
import { type ProvisionedDashboardFormData } from '../../types/form';
import { type CommitTemplateVars, getSingleResourceCommitMessage } from '../../utils/commitMessage';
import { getCurrentCommitUser } from '../../utils/currentUser';
import { buildResourceBranchRedirectUrl } from '../../utils/redirect';
import { ProvisioningAwareFolderPicker } from '../Shared/ProvisioningAwareFolderPicker';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getProvisionedRequestError } from '../utils/errors';
import { validateProvisionedFolderName } from '../utils/folderName';
import { getProvisionedMeta } from '../utils/getProvisionedMeta';
import { ensureFolderPathTrailingSlash, joinPath, slugifyForFilename, splitPath } from '../utils/path';

import { type SaveProvisionedDashboardProps } from './SaveProvisionedDashboard';

export interface Props extends SaveProvisionedDashboardProps {
  isNew: boolean;
  defaultValues: ProvisionedDashboardFormData;
  canPushToConfiguredBranch: boolean;
  readOnly: boolean;
  repository?: RepositoryView;
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
}: Props) {
  const navigate = useNavigate();
  const { isDirty } = dashboard.useState();
  const [error, setError] = useState<string | undefined>(undefined);
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
  const originalPath = isNew ? undefined : defaultValues.path;
  const isRename = Boolean(originalPath && path !== originalPath);

  const [createOrUpdateFile, request] = useCreateOrUpdateRepositoryFile(isRename ? undefined : originalPath);

  // button enabled if form comment is dirty or dashboard state is dirty or raw JSON was provided from editor
  const rawDashboardJSON = dashboard.getRawJsonFromEditor();
  const isDirtyState =
    Boolean(dirtyFields.comment) || Boolean(dirtyFields.path) || isDirty || Boolean(rawDashboardJSON);
  const [workflow, ref] = watch(['workflow', 'ref']);
  const isFolderless = repository?.target === 'folderless';
  const title = watch('title');

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
  }, [defaultValues, reset]);

  const templateVars: CommitTemplateVars = {
    action: isNew ? 'create' : 'update',
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

  const { locked: lockBranch } = useBranchTemplate({
    repository,
    vars: templateVars,
    workflow,
    value: ref ?? '',
    setBranch: (value) => setValue('ref', value, { shouldDirty: false }),
  });

  const { prTitle } = usePullRequestTitle({ repository, vars: templateVars, workflow });

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

  const showError = (error: unknown) => {
    setError(
      getProvisionedRequestError(
        error,
        t('dashboard-scene.save-provisioned-dashboard-form.error-saving', 'An error occurred while saving.')
      )
    );
  };

  const handleNewDashboard = useCallback(
    (upsert: Resource<Dashboard>) => {
      // Navigation for new dashboards
      const url = locationUtil.assureBaseUrl(
        getDashboardUrl({
          uid: upsert.metadata.name,
          slug: kbn.slugifyForUrl(upsert.spec.title ?? ''),
          currentQueryParams: window.location.search,
        })
      );
      navigate(url);
    },
    [navigate]
  );

  const navigateToPreview = useCallback(
    (ref: string, path: string, repoType?: string) => {
      const url = buildResourceBranchRedirectUrl({
        baseUrl: `${PROVISIONING_PREVIEW_URL}/${defaultValues.repo}/preview/${path}`,
        paramName: 'ref',
        paramValue: ref,
        repoType,
        prTitle,
      });
      navigate(url);
    },
    [navigate, defaultValues.repo, prTitle]
  );

  const handleDismiss = useCallback(
    (wrapper: ResourceWrapper) => {
      // Baseline against exactly what was committed. On the update path that is the
      // change-trimmed model; getSaveModel() would re-include values the toggles
      // omitted, so change detection would treat them as already saved until reload.
      const model = savedSpecRef.current ?? dashboard.getSaveModel();
      const resourceData = wrapper.resource.upsert || wrapper.resource.dryRun;
      const saveResponse = createSaveResponseFromResource(resourceData);
      dashboard.saveCompleted(model, saveResponse, defaultValues.folder?.uid);
      dashboardWatcher.clearIgnoreSave();
    },
    [dashboard, defaultValues.folder?.uid]
  );

  const onWriteSuccess = useCallback(
    (upsert: Resource<Dashboard>, wrapper: ResourceWrapper) => {
      handleDismiss(wrapper);
      if (isNew && upsert?.metadata.name) {
        handleNewDashboard(upsert);
      }

      // if pushed to an existing but non-configured branch, navigate to preview page
      if (ref !== repository?.branch && ref) {
        navigateToPreview(ref, path, repository?.type);
        return;
      }

      locationService.partial({
        viewPanel: null,
        editPanel: null,
      });
    },
    [isNew, path, ref, repository?.branch, repository?.type, handleDismiss, handleNewDashboard, navigateToPreview]
  );

  const onBranchSuccess = useCallback(
    (
      ref: string,
      path: string,
      info: ProvisionedOperationInfo,
      upsert: Resource<Dashboard>,
      wrapper: ResourceWrapper
    ) => {
      handleDismiss(wrapper);
      if (isNew && upsert?.metadata?.name) {
        handleNewDashboard(upsert);
      } else {
        navigateToPreview(ref, path, info.repoType);
      }
    },
    [isNew, navigateToPreview, handleNewDashboard, handleDismiss]
  );
  // Updating the dashboard meta (not just the form field) makes the defaults recompute
  // against the selected folder, so path and post-save handlers stay in sync.
  const selectFolder = useCallback(
    async (uid?: string, title?: string) => {
      setValue('folder', { uid, title });
      const meta = await getProvisionedMeta(uid);
      dashboard.setState({
        meta: {
          ...meta,
          folderUid: uid,
        },
      });
    },
    [setValue, dashboard]
  );

  const handleSaveAtRoot = useCallback(() => {
    const { filename } = splitPath(getValues('path'));
    setValue('path', filename);
    selectFolder();
  }, [getValues, setValue, selectFolder]);

  const handleCreateFolder = useCallback(async () => {
    if (isCreatingFolderRef.current) {
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
      workflow,
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
        message: getSingleResourceCommitMessage({
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
        try {
          await selectFolder(uid, folderName);
        } catch {
          // The folder was created; a failed selection sync must not surface as a creation error
        }
      } else {
        // Sync disabled: no folder resource to select, mark path dirty so resets keep the new location
        setValue('path', joinPath(folderPath, filename), { shouldDirty: true });
      }
      setShowNewFolderForm(false);
      setNewFolderName('');
    }
    isCreatingFolderRef.current = false;
    setIsCreatingFolder(false);
  }, [newFolderName, repository, workflow, createFolder, setValue, getValues, selectFolder]);

  const { handleSuccess } = useProvisionedRequestHandler<Dashboard>({
    folderUID: defaultValues.folder?.uid,
    resourceType: 'dashboard',
    repository,
    handlers: {
      onBranchSuccess: ({ ref, path }, info, resource, wrapper) => onBranchSuccess(ref, path, info, resource, wrapper),
      onWriteSuccess,
    },
  });

  // Submit handler for saving the form data
  const handleFormSubmit = async ({ title, description, repo, path, ref, copyTags }: ProvisionedDashboardFormData) => {
    setError(undefined);
    // Validate required fields
    if (!repo || !path) {
      showError(
        t('dashboard-scene.save-provisioned-dashboard-form.repo-path-required', 'Missing required fields for saving')
      );
      return;
    }

    // TODO: Revisit after we decide on whether to keep the branch selection functionality
    // If user is updating a dashboard in the original branch, override ref with whatever we loaded from
    // if (workflow === 'write' && !isNew) {
    //   ref = loadedFromRef;
    // }

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
          // shown in the drawer. This mirrors the non-provisioned save path.
          dashboard.getSaveResourceFromSpec(changeInfo.changedSaveModel);

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
        // Skip adding ref to the default branch request
        ref: ref === repository?.branch ? undefined : ref,
        name: repo,
        path,
        message,
        body,
        originalPath: isRename ? originalPath : undefined,
      }).unwrap();
      handleSuccess(data, { workflow, selectedBranch: ref });
    } catch (err) {
      // Release suppression so later live save/conflict events from other sessions
      // aren't hidden while the user retries or abandons the save.
      dashboardWatcher.clearIgnoreSave();
      showError(err);
    }
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
              {isFolderless && (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    fill="text"
                    onClick={handleSaveAtRoot}
                    disabled={isCreatingFolder}
                  >
                    <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.no-folder-root">
                      No folder (repository root)
                    </Trans>
                  </Button>
                </div>
              )}
              {isFolderless && workflow === 'write' && (
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
                      >
                        <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.new-folder">New folder</Trans>
                      </Button>
                    </div>
                  )}

                  {showNewFolderForm && (
                    <Stack direction="column" gap={1}>
                      <Field
                        noMargin
                        label={t('dashboard-scene.save-provisioned-dashboard-form.label-folder-name', 'Folder name')}
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
                          disabled={!newFolderName || isCreatingFolder}
                        >
                          <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.create-folder">Create</Trans>
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
                          <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cancel-folder">Cancel</Trans>
                        </Button>
                      </Stack>
                    </Stack>
                  )}
                </>
              )}
            </>
          )}

          {!isNew && !readOnly && <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />}

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
          />

          {saveAsCopy && (
            <Field noMargin label={t('dashboard-scene.save-dashboard-as-form.label-copy-tags', 'Copy tags')}>
              <Switch {...register('copyTags')} />
            </Field>
          )}

          {error && <ProvisioningAlert error={error} />}

          <Stack gap={2}>
            <Button variant="secondary" onClick={drawer.onClose} fill="outline">
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cancel">Cancel</Trans>
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={
                request.isLoading || readOnly || !isDirtyState || isSubmitting || isValidating || isCreatingFolder
              }
            >
              {request.isLoading || isSubmitting || isValidating
                ? t('dashboard-scene.save-provisioned-dashboard-form.saving', 'Saving...')
                : t('dashboard-scene.save-provisioned-dashboard-form.save', 'Save')}
            </Button>
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
