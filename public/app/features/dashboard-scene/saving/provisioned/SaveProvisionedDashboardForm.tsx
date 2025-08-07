import { useEffect } from 'react';
import { Controller, useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { Button, Field, Input, Stack, TextArea } from '@grafana/ui';
import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import kbn from 'app/core/utils/kbn';
import { Resource } from 'app/features/apiserver/types';
import { RepoInvalidStateBanner } from 'app/features/browse-dashboards/components/BulkActions/RepoInvalidStateBanner';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile';

import { ResourceEditFormSharedFields } from '../../components/Provisioned/ResourceEditFormSharedFields';
import { buildResourceBranchRedirectUrl } from '../../settings/utils';
import { getDashboardUrl } from '../../utils/getDashboardUrl';
import { ProvisionedOperationInfo, useProvisionedRequestHandler } from '../../utils/useProvisionedRequestHandler';
import { SaveDashboardFormCommonOptions } from '../SaveDashboardForm';
import { ProvisionedDashboardFormData } from '../shared';

import { SaveProvisionedDashboardProps } from './SaveProvisionedDashboard';
import { getProvisionedMeta } from './utils/getProvisionedMeta';

export interface Props extends SaveProvisionedDashboardProps {
  isNew: boolean;
  defaultValues: ProvisionedDashboardFormData;
  loadedFromRef?: string;
  workflowOptions: Array<{ label: string; value: string }>;
  readOnly: boolean;
  repository?: RepositoryView;
}

export function SaveProvisionedDashboardForm({
  defaultValues,
  dashboard,
  drawer,
  changeInfo,
  isNew,
  loadedFromRef,
  workflowOptions,
  readOnly,
  repository,
}: Props) {
  const navigate = useNavigate();
  const appEvents = getAppEvents();
  const { isDirty, editPanel: panelEditor } = dashboard.useState();

  const [createOrUpdateFile, request] = useCreateOrUpdateRepositoryFile(isNew ? undefined : defaultValues.path);

  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { handleSubmit, watch, control, reset, register } = methods;
  const [workflow] = watch(['workflow']);

  // Update the form if default values change
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onRequestError = (error: unknown) => {
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: [t('dashboard-scene.save-provisioned-dashboard-form.api-error', 'Error saving dashboard'), error],
    });
  };

  const handleNewDashboard = (upsert: Resource<Dashboard>) => {
    // Navigation for new dashboards
    const url = locationUtil.assureBaseUrl(
      getDashboardUrl({
        uid: upsert.metadata.name,
        slug: kbn.slugifyForUrl(upsert.spec.title ?? ''),
        currentQueryParams: window.location.search,
      })
    );
    navigate(url);
  };

  const onWriteSuccess = (_: ProvisionedOperationInfo, upsert: Resource<Dashboard>) => {
    handleDismiss();
    if (isNew && upsert?.metadata.name) {
      handleNewDashboard(upsert);
    } else {
      locationService.partial({
        viewPanel: null,
        editPanel: null,
      });
    }
  };

  const onBranchSuccess = (ref: string, path: string, info: ProvisionedOperationInfo, upsert: Resource<Dashboard>) => {
    handleDismiss();
    if (isNew && upsert?.metadata?.name) {
      handleNewDashboard(upsert);
    } else {
      const url = buildResourceBranchRedirectUrl({
        baseUrl: `${PROVISIONING_URL}/${defaultValues.repo}/dashboard/preview/${path}`,
        paramName: 'ref',
        paramValue: ref,
        repoType: info.repoType,
      });
      navigate(url);
    }
  };

  const handleDismiss = () => {
    dashboard.setState({ isDirty: false });
    panelEditor?.onDiscard();
    drawer.onClose();
  };

  useProvisionedRequestHandler<Dashboard>({
    request,
    workflow,
    resourceType: 'dashboard',
    handlers: {
      onBranchSuccess: ({ ref, path }, info, resource) => onBranchSuccess(ref, path, info, resource),
      onWriteSuccess,
      onError: onRequestError,
    },
  });

  // Submit handler for saving the form data
  const handleFormSubmit = async ({ title, description, repo, path, comment, ref }: ProvisionedDashboardFormData) => {
    // Validate required fields
    if (!repo || !path) {
      console.error('Missing required fields for saving:', { repo, path });
      return;
    }

    // If user is writing to the original branch, override ref with whatever we loaded from
    if (workflow === 'write') {
      ref = loadedFromRef;
    }

    const message = comment || `Save dashboard: ${dashboard.state.title}`;

    const body = dashboard.getSaveResource({
      isNew,
      title,
      description,
    });

    createOrUpdateFile({
      ref,
      name: repo,
      path,
      message,
      body,
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
                      <FolderPicker
                        onChange={async (uid?: string, title?: string) => {
                          onChange({ uid, title });
                          // Update folderUid URL param
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
            workflow={workflow}
            workflowOptions={workflowOptions}
            repository={repository}
            isNew={isNew}
          />

          <Stack gap={2}>
            <Button variant="primary" type="submit" disabled={request.isLoading || !isDirty || readOnly}>
              {request.isLoading
                ? t('dashboard-scene.save-provisioned-dashboard-form.saving', 'Saving...')
                : t('dashboard-scene.save-provisioned-dashboard-form.save', 'Save')}
            </Button>
            <Button variant="secondary" onClick={drawer.onClose} fill="outline">
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cancel">Cancel</Trans>
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
  if (!value) {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set(param, value);
  window.history.replaceState({}, '', url);
}
