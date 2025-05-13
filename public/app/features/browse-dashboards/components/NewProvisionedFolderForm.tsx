import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Button, Field, Input, RadioButtonGroup, Spinner, Stack, TextArea } from '@grafana/ui';
import { useCreateRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning';
import { t, Trans } from 'app/core/internationalization';
import { AnnoKeySourcePath, Resource } from 'app/features/apiserver/types';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/dashboard-scene/saving/provisioned/defaults';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { BranchValidationError } from 'app/features/provisioning/Shared/BranchValidationError';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';
import { FolderDTO } from 'app/types';

type FormData = {
  ref?: string;
  path: string;
  comment?: string;
  repo: string;
  workflow?: WorkflowOption;
  title: string;
};

interface Props {
  onSubmit: () => void;
  onCancel: () => void;
  parentFolder?: FolderDTO;
}

const initialFormValues: Partial<FormData> = {
  title: '',
  comment: '',
  ref: `folder/${Date.now()}`,
};

export function NewProvisionedFolderForm({ onSubmit, onCancel, parentFolder }: Props) {
  const { repository, folder, isLoading } = useGetResourceRepositoryView({ folderName: parentFolder?.uid });
  const prURL = usePullRequestParam();
  const navigate = useNavigate();
  const [create, request] = useCreateRepositoryFilesWithPathMutation();

  const isGitHub = Boolean(repository?.type === 'github');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    control,
    setValue,
  } = useForm<FormData>({ defaultValues: { ...initialFormValues, workflow: getDefaultWorkflow(repository) } });

  const [workflow, ref] = watch(['workflow', 'ref']);

  useEffect(() => {
    setValue('workflow', getDefaultWorkflow(repository));
  }, [repository, setValue]);

  useEffect(() => {
    const appEvents = getAppEvents();
    if (request.isSuccess && repository) {
      onSubmit();

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
  }, [request.isSuccess, request.isError, request.error, onSubmit, ref, request.data, workflow, navigate, repository]);

  if (isLoading) {
    return <Spinner />;
  }

  if (!repository) {
    return (
      <Alert
        title={t('browse-dashboards.new-provisioned-folder-form.title-repository-not-found', 'Repository not found')}
        severity="error"
      />
    );
  }

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

  const doSave = async ({ ref, title, workflow, comment }: FormData) => {
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
          label={t('browse-dashboards.new-provisioned-folder-form.label-folder-name', 'Folder name')}
          invalid={!!errors.title}
          error={errors.title?.message}
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

        <Field label={t('browse-dashboards.new-provisioned-folder-form.label-comment', 'Comment')}>
          <TextArea
            {...register('comment')}
            placeholder={t(
              'browse-dashboards.new-provisioned-folder-form.folder-comment-input-placeholder-describe-changes-optional',
              'Add a note to describe your changes (optional)'
            )}
            id="folder-comment-input"
            rows={5}
          />
        </Field>

        {isGitHub && (
          <>
            <Field label={t('browse-dashboards.new-provisioned-folder-form.label-workflow', 'Workflow')}>
              <Controller
                control={control}
                name="workflow"
                render={({ field: { ref, ...field } }) => (
                  <RadioButtonGroup {...field} options={getWorkflowOptions(repository)} id={'folder-workflow'} />
                )}
              />
            </Field>
            {workflow === 'branch' && (
              <Field
                label={t('browse-dashboards.new-provisioned-folder-form.label-branch', 'Branch')}
                description={t(
                  'browse-dashboards.new-provisioned-folder-form.description-branch-name-in-git-hub',
                  'Branch name in GitHub'
                )}
                invalid={!!errors?.ref}
                error={errors.ref ? <BranchValidationError /> : ''}
              >
                <Input {...register('ref', { validate: validateBranchName })} id="branch-name-input" />
              </Field>
            )}
          </>
        )}

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
          <Button variant="secondary" fill="outline" onClick={onCancel}>
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
  );
}
