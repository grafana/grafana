import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, locationUtil } from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { Alert, Button, Field, Input, RadioButtonGroup, Stack, TextArea } from '@grafana/ui';
import { RepositoryView } from 'app/api/clients/provisioning';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { t, Trans } from 'app/core/internationalization';
import kbn from 'app/core/utils/kbn';
import { Resource } from 'app/features/apiserver/types';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { BranchValidationError } from 'app/features/provisioning/Shared/BranchValidationError';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';

import { getDashboardUrl } from '../../utils/getDashboardUrl';
import { SaveDashboardFormCommonOptions } from '../SaveDashboardForm';

import { SaveProvisionedDashboardProps } from './SaveProvisionedDashboard';
import { getWorkflowOptions } from './defaults';
import { getProvisionedMeta } from './utils/getProvisionedMeta';

type FormData = {
  ref?: string;
  path: string;
  comment?: string;
  repo: string;
  workflow?: WorkflowOption;
  title: string;
  description: string;
  folder: {
    uid?: string;
    title?: string;
  };
};

export interface Props extends SaveProvisionedDashboardProps {
  isNew: boolean;
  defaultValues: FormData;
  isGitHub: boolean;
  repository?: RepositoryView;
  loadedFromRef?: string;
}

export function SaveProvisionedDashboardForm({
  defaultValues,
  dashboard,
  drawer,
  changeInfo,
  isNew,
  loadedFromRef,
  repository,
  isGitHub,
}: Props) {
  const navigate = useNavigate();
  const appEvents = getAppEvents();
  const { isDirty, editPanel: panelEditor } = dashboard.useState();

  const [createOrUpdateFile, request] = useCreateOrUpdateRepositoryFile(isNew ? undefined : defaultValues.path);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    control,
    reset,
  } = useForm<FormData>({ defaultValues });
  const [ref, workflow, path] = watch(['ref', 'workflow', 'path']);

  // Update the form if default values change
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    if (request.isSuccess) {
      dashboard.setState({ isDirty: false });

      if (workflow === 'branch' && ref !== '' && path !== '') {
        dashboard.closeModal();
        panelEditor?.onDiscard();
        // Redirect to the provisioning preview pages
        navigate(`${PROVISIONING_URL}/${defaultValues.repo}/dashboard/preview/${path}?ref=${ref}`);
        return;
      }

      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: [t('dashboard-scene.save-provisioned-dashboard-form.api-success', 'Dashboard changes saved')],
      });

      // Load the new URL
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const upsert = request.data.resource.upsert as Resource<Dashboard>;
      if (isNew && upsert?.metadata?.name) {
        const url = locationUtil.assureBaseUrl(
          getDashboardUrl({
            uid: upsert.metadata.name,
            slug: kbn.slugifyForUrl(upsert.spec.title ?? ''),
            currentQueryParams: window.location.search,
          })
        );

        navigate(url);
        return;
      }

      // Keep the same URL
      dashboard.closeModal();
      locationService.partial({
        viewPanel: null,
        editPanel: null,
      });
    } else if (request.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('dashboard-scene.save-provisioned-dashboard-form.api-error', 'Error saving dashboard'),
          request.error,
        ],
      });
    }
  }, [appEvents, dashboard, defaultValues.repo, drawer, isNew, navigate, panelEditor, path, ref, request, workflow]);

  // Submit handler for saving the form data
  const handleFormSubmit = async ({ title, description, repo, path, comment, ref }: FormData) => {
    if (!repo || !path) {
      return;
    }

    // If user is writing to the original branch, override ref with whatever we loaded from
    if (workflow === 'write') {
      ref = loadedFromRef;
    }

    const body = dashboard.getSaveResource({
      isNew,
      title,
      description,
    });

    createOrUpdateFile({
      ref,
      name: repo,
      path,
      message: comment,
      body,
    });
  };

  const workflowOptions = getWorkflowOptions(repository, loadedFromRef);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} name="save-provisioned-form">
      <Stack direction="column" gap={2}>
        {!repository?.workflows?.length && (
          <Alert
            title={t(
              'dashboard-scene.save-provisioned-dashboard-form.title-this-repository-is-read-only',
              'This repository is read only'
            )}
          >
            <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.copy-json-message">
              If you have direct access to the target, copy the JSON and paste it there.
            </Trans>
          </Alert>
        )}

        {isNew && (
          <>
            <Field
              label={t('dashboard-scene.save-provisioned-dashboard-form.label-title', 'Title')}
              invalid={!!errors.title}
              error={errors.title?.message}
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
              label={t('dashboard-scene.save-provisioned-dashboard-form.label-description', 'Description')}
              invalid={!!errors.description}
              error={errors.description?.message}
            >
              <TextArea id="dashboard-description" {...register('description')} />
            </Field>

            <Field label={t('dashboard-scene.save-provisioned-dashboard-form.label-target-folder', 'Target folder')}>
              <Controller
                control={control}
                name={'folder'}
                render={({ field: { ref, value, onChange, ...field } }) => {
                  return (
                    <FolderPicker
                      inputId="dashboard-folder"
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

        {!isNew && <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />}

        <Field
          label={t('dashboard-scene.save-provisioned-dashboard-form.label-path', 'Path')}
          description={t(
            'dashboard-scene.save-provisioned-dashboard-form.description-inside-repository',
            'File path inside the repository (.json or .yaml)'
          )}
        >
          <Input id="dashboard-path" {...register('path')} readOnly={!isNew} />
        </Field>

        <Field label={t('dashboard-scene.save-provisioned-dashboard-form.label-comment', 'Comment')}>
          <TextArea
            id="dashboard-comment"
            {...register('comment')}
            placeholder={t(
              'dashboard-scene.save-provisioned-dashboard-form.dashboard-comment-placeholder-describe-changes-optional',
              'Add a note to describe your changes (optional)'
            )}
            rows={5}
          />
        </Field>

        {isGitHub && (
          <>
            <Field label={t('dashboard-scene.save-provisioned-dashboard-form.label-workflow', 'Workflow')}>
              <Controller
                control={control}
                name="workflow"
                render={({ field: { ref: _, ...field } }) => (
                  <RadioButtonGroup id="dashboard-workflow" {...field} options={workflowOptions} />
                )}
              />
            </Field>
            {workflow === 'branch' && (
              <Field
                label={t('dashboard-scene.save-provisioned-dashboard-form.label-branch', 'Branch')}
                description={t(
                  'dashboard-scene.save-provisioned-dashboard-form.description-branch-name-in-git-hub',
                  'Branch name in GitHub'
                )}
                invalid={!!errors.ref}
                error={errors.ref && <BranchValidationError />}
              >
                <Input id="dashboard-branch" {...register('ref', { validate: validateBranchName })} />
              </Field>
            )}
          </>
        )}

        <Stack gap={2}>
          <Button variant="primary" type="submit" disabled={request.isLoading || !isDirty}>
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
  );
}

/**
 * Dashboard title validation to ensure it's not the same as the folder name
 * and meets other naming requirements.
 */
async function validateTitle(title: string, formValues: FormData) {
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
