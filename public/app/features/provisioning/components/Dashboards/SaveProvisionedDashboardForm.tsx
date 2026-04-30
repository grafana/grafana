import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { Button, Field, Input, Stack, TextArea, Switch } from '@grafana/ui';
import { type RepositoryView, type Unstructured } from 'app/api/clients/provisioning/v0alpha1';
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
import { type ProvisionedDashboardFormData } from '../../types/form';
import { buildResourceBranchRedirectUrl } from '../../utils/redirect';
import { ProvisioningAwareFolderPicker } from '../Shared/ProvisioningAwareFolderPicker';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getProvisionedRequestError } from '../utils/errors';
import { getProvisionedMeta } from '../utils/getProvisionedMeta';
import { joinPath, slugifyForFilename, splitPath } from '../utils/path';

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

  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const {
    handleSubmit,
    watch,
    control,
    reset,
    register,
    setValue,
    getValues,
    formState: { dirtyFields },
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
  const title = watch('title');

  // Clear indefinite save-event suppression on unmount (covers cancel, error, navigation away).
  useEffect(() => {
    return () => {
      dashboardWatcher.clearIgnoreSave();
    };
  }, []);

  // Update the form if default values change
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // Sync filename from title for new dashboards.
  // dirtyFields.path is false when only setValue() has updated the path (shouldDirty defaults to false),
  // and becomes true when the user manually types in the filename input (Controller onChange marks it dirty).
  // This lets us stop auto-syncing once the user has intentionally customised the filename.
  useEffect(() => {
    if (!isNew || dirtyFields.path) {
      return;
    }
    const slugified = slugifyForFilename(title);
    if (slugified) {
      const currentPath = getValues('path');
      const { directory } = splitPath(currentPath);
      setValue('path', joinPath(directory, `${slugified}.json`));
    }
  }, [title, isNew, dirtyFields.path, setValue, getValues]);

  const showError = (error: unknown) => {
    setError(
      getProvisionedRequestError(
        error,
        'dashboard',
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
      });
      navigate(url);
    },
    [navigate, defaultValues.repo]
  );

  const handleDismiss = useCallback(() => {
    const model = dashboard.getSaveModel();
    const resourceData = request?.data?.resource.upsert || request?.data?.resource.dryRun;
    const saveResponse = createSaveResponseFromResource(resourceData);
    dashboard.saveCompleted(model, saveResponse, defaultValues.folder?.uid);
    dashboardWatcher.clearIgnoreSave();
  }, [dashboard, defaultValues.folder?.uid, request?.data?.resource]);

  const onWriteSuccess = useCallback(
    (upsert: Resource<Dashboard>) => {
      handleDismiss();
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
    (ref: string, path: string, info: ProvisionedOperationInfo, upsert: Resource<Dashboard>) => {
      handleDismiss();
      if (isNew && upsert?.metadata?.name) {
        handleNewDashboard(upsert);
      } else {
        navigateToPreview(ref, path, info.repoType);
      }
    },
    [isNew, navigateToPreview, handleNewDashboard, handleDismiss]
  );

  useProvisionedRequestHandler<Dashboard>({
    folderUID: defaultValues.folder?.uid,
    request,
    workflow,
    resourceType: 'dashboard',
    repository,
    selectedBranch: methods.getValues().ref,
    handlers: {
      onBranchSuccess: ({ ref, path }, info, resource) => onBranchSuccess(ref, path, info, resource),
      onWriteSuccess,
      onError: (err) => {
        // Release suppression so later live save/conflict events from other sessions
        // aren't hidden while the user retries or abandons the save.
        dashboardWatcher.clearIgnoreSave();
        showError(err);
      },
    },
  });

  // Submit handler for saving the form data
  const handleFormSubmit = async ({
    title,
    description,
    repo,
    path,
    comment,
    ref,
    copyTags,
  }: ProvisionedDashboardFormData) => {
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

    const message = comment || `Save dashboard: ${dashboard.state.title}`;

    const body = rawDashboardJSON
      ? dashboard.getSaveResourceFromSpec(rawDashboardJSON)
      : dashboard.getSaveResource({
          isNew,
          title,
          description,
          copyTags,
          saveAsCopy,
        });

    reportInteraction('grafana_provisioning_dashboard_save_submitted', {
      workflow,
      repositoryName: repo,
      repositoryType: repository?.type ?? 'unknown',
    });

    // Suppress live save events for the duration of the provisioned save.
    // Git operations can exceed the default 5s ignoreNextSave window.
    dashboardWatcher.ignoreSaveIndefinitely();

    createOrUpdateFile({
      // Skip adding ref to the default branch request
      ref: ref === repository?.branch ? undefined : ref,
      name: repo,
      path,
      message,
      body,
      originalPath: isRename ? originalPath : undefined,
    });
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
                        onChange={async (uid?: string, title?: string) => {
                          onChange({ uid, title });
                          updateURLParams('folderUid', uid);
                          const meta = await getProvisionedMeta(uid);
                          dashboard.setState({
                            meta: {
                              ...meta,
                              folderUid: uid,
                            },
                          });
                        }}
                        value={value.uid}
                        {...field}
                        showAllFolders
                      />
                    );
                  }}
                />
              </Field>
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
            <Button variant="primary" type="submit" disabled={request.isLoading || readOnly || !isDirtyState}>
              {request.isLoading
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

// Update the URL params without reloading the page
function updateURLParams(param: string, value?: string) {
  // only check undefine and null, empty string = root folder, we still want to update the URL
  if (value === undefined || value === null) {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set(param, value);
  window.history.replaceState({}, '', url);
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
