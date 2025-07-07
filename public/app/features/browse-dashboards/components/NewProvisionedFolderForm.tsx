import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Button, Field, Input, Stack } from '@grafana/ui';
import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView, useCreateRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath, Resource } from 'app/features/apiserver/types';
import { ResourceEditFormSharedFields } from 'app/features/dashboard-scene/components/Provisioned/ResourceEditFormSharedFields';
import { BaseProvisionedFormData } from 'app/features/dashboard-scene/saving/shared';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { FolderDTO } from 'app/types';

import { useProvisionedFolderFormData } from '../hooks/useProvisionedFolderFormData';
interface FormProps extends Props {
  initialValues: BaseProvisionedFormData;
  repository?: RepositoryView;
  workflowOptions: Array<{ label: string; value: string }>;
  folder?: Folder;
  isGitHub: boolean;
}
interface Props {
  parentFolder?: FolderDTO;
  onDismiss?: () => void;
}

function FormContent({ initialValues, repository, workflowOptions, folder, isGitHub, onDismiss }: FormProps) {
  const prURL = usePullRequestParam();
  const navigate = useNavigate();
  const [create, request] = useCreateRepositoryFilesWithPathMutation();

  const methods = useForm<BaseProvisionedFormData>({
    defaultValues: initialValues,
    mode: 'onBlur', // Validates when user leaves the field
  });
  const { handleSubmit, watch, register, formState } = methods;

  const [workflow, ref] = watch(['workflow', 'ref']);

  // TODO: replace with useProvisionedRequestHandler hook
  useEffect(() => {
    const appEvents = getAppEvents();
    if (request.isSuccess && repository) {
      onDismiss?.();

      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: [
          t(
            'browse-dashboards.new-provisioned-folder-form.alert-folder-created-successfully',
            'Folder created successfully'
          ),
        ],
      });

      // TODO: Update when the upsert type is fixed
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const folder = request.data.resource?.upsert as Resource;
      if (folder?.metadata?.name) {
        navigate(`/dashboards/f/${folder?.metadata?.name}/`);
        return;
      }

      let url = `${PROVISIONING_URL}/${repository.name}/file/${request.data.path}`;
      if (request.data.ref?.length) {
        url += '?ref=' + request.data.ref;
      }
      navigate(url);
    } else if (request.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('browse-dashboards.new-provisioned-folder-form.alert-error-creating-folder', 'Error creating folder'),
          request.error,
        ],
      });
    }
  }, [request.isSuccess, request.isError, request.error, ref, request.data, workflow, navigate, repository, onDismiss]);

  const validateFolderName = async (folderName: string) => {
    try {
      await validationSrv.validateNewFolderName(folderName);
      return true;
    } catch (e) {
      if (e instanceof Error) {
        return e.message;
      }
      return t('browse-dashboards.new-provisioned-folder-form.error-invalid-folder-name', 'Invalid folder name');
    }
  };

  const doSave = async ({ ref, title, workflow, comment }: BaseProvisionedFormData) => {
    const repoName = repository?.name;
    if (!title || !repoName) {
      return;
    }
    const basePath = folder?.metadata?.annotations?.[AnnoKeySourcePath] ?? '';

    // Convert folder title to filename format (lowercase, replace spaces with hyphens)
    const titleInFilenameFormat = title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const prefix = basePath ? `${basePath}/` : '';
    const path = `${prefix}${titleInFilenameFormat}/`;

    const folderModel = {
      title,
      type: 'folder',
    };

    if (workflow === 'write') {
      ref = undefined;
    }

    create({
      ref,
      name: repoName,
      path,
      message: comment || `Create folder: ${title}`,
      body: folderModel,
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(doSave)}>
        <Stack direction="column" gap={2}>
          {!repository?.workflows?.length && (
            <Alert
              title={t(
                'browse-dashboards.new-provisioned-folder-form.title-this-repository-is-read-only',
                'This repository is read only'
              )}
            >
              <Trans i18nKey="browse-dashboards.text-this-repository-is-read-only">
                If you have direct access to the target, copy the JSON and paste it there.
              </Trans>
            </Alert>
          )}

          <Field
            noMargin
            label={t('browse-dashboards.new-provisioned-folder-form.label-folder-name', 'Folder name')}
            invalid={!!formState.errors.title}
            error={formState.errors.title?.message}
          >
            <Input
              {...register('title', {
                required: t('browse-dashboards.new-provisioned-folder-form.error-required', 'Folder name is required'),
                validate: validateFolderName,
              })}
              placeholder={t(
                'browse-dashboards.new-provisioned-folder-form.folder-name-input-placeholder-enter-folder-name',
                'Enter folder name'
              )}
              id="folder-name-input"
            />
          </Field>

          <ResourceEditFormSharedFields
            resourceType="folder"
            isNew={false}
            workflow={workflow}
            workflowOptions={workflowOptions}
            isGitHub={isGitHub}
            hidePath
          />

          {prURL && (
            <Alert
              severity="info"
              title={t(
                'browse-dashboards.new-provisioned-folder-form.title-pull-request-created',
                'Pull request created'
              )}
            >
              <Trans i18nKey="browse-dashboards.new-provisioned-folder-form.text-pull-request-created">
                A pull request has been created with changes to this folder:
              </Trans>{' '}
              <a href={prURL} target="_blank" rel="noopener noreferrer">
                {prURL}
              </a>
            </Alert>
          )}

          <Stack gap={2}>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              <Trans i18nKey="browse-dashboards.new-provisioned-folder-form.cancel">Cancel</Trans>
            </Button>
            <Button type="submit" disabled={request.isLoading}>
              {request.isLoading
                ? t('browse-dashboards.new-provisioned-folder-form.button-creating', 'Creating...')
                : t('browse-dashboards.new-provisioned-folder-form.button-create', 'Create')}
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

export function NewProvisionedFolderForm({ parentFolder, onDismiss }: Props) {
  const { workflowOptions, isGitHub, repository, folder, initialValues } = useProvisionedFolderFormData({
    folderUid: parentFolder?.uid,
    action: 'create',
    title: '', // Empty title for new folders
  });

  if (!initialValues) {
    return null;
  }

  return (
    <FormContent
      parentFolder={parentFolder}
      onDismiss={onDismiss}
      initialValues={initialValues}
      repository={repository}
      workflowOptions={workflowOptions}
      folder={folder}
      isGitHub={isGitHub}
    />
  );
}
