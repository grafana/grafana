import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Button, Field, Input, RadioButtonGroup, Stack, TextArea } from '@grafana/ui';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { useCreateRepositoryFilesWithPathMutation, useGetRepositoryQuery } from 'app/features/provisioning/api';
import { usePullRequestParam } from 'app/features/provisioning/hooks';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';

import { getDefaultWorkflow, getWorkflowOptions } from '../../dashboard-scene/saving/provisioned/defaults';

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
  repositoryName: string;
  parentTitle: string;
}

const initialFormValues: Partial<FormData> = {
  title: '',
  comment: '',
  ref: `folder/${Date.now()}`,
};

export function NewProvisionedFolderForm({ onSubmit, onCancel, repositoryName, parentTitle }: Props) {
  const query = useGetRepositoryQuery({ name: repositoryName });
  const repositoryConfig = query.data?.spec;
  const prURL = usePullRequestParam();
  const isGitHub = Boolean(repositoryConfig?.github);

  const [create, request] = useCreateRepositoryFilesWithPathMutation();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    control,
    setValue,
  } = useForm<FormData>({ defaultValues: { ...initialFormValues, workflow: getDefaultWorkflow(repositoryConfig) } });

  const [workflow] = watch(['workflow']);

  useEffect(() => {
    setValue('workflow', getDefaultWorkflow(repositoryConfig));
  }, [repositoryConfig, setValue]);

  useEffect(() => {
    const appEvents = getAppEvents();
    if (request.isSuccess) {
      onSubmit();
    } else if (request.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error creating folder', request.error],
      });
    }
  }, [request.isSuccess, request.isError, request.error, onSubmit]);

  const validateFolderName = async (folderName: string) => {
    try {
      await validationSrv.validateNewFolderName(folderName);
      return true;
    } catch (e) {
      if (e instanceof Error) {
        return e.message;
      }
      return 'Invalid folder name';
    }
  };

  const doSave = async ({ ref, title, workflow, comment }: FormData) => {
    if (!title) {
      return;
    }

    const path = `${title.toLowerCase().replace(/\s+/g, '-')}/`;
    const folderModel = {
      title,
      type: 'folder',
    };

    if (workflow === 'write') {
      ref = undefined;
    }

    create({
      ref,
      name: repositoryName,
      path,
      message: comment || `Create folder: ${title}`,
      body: folderModel,
    });
  };

  return (
    <form onSubmit={handleSubmit(doSave)}>
      <Stack direction="column" gap={2}>
        {!repositoryConfig?.workflows.length && (
          <Alert title="This repository is read only">
            If you have direct access to the target, copy the JSON and paste it there.
          </Alert>
        )}

        <Field label="Folder name" invalid={!!errors.title} error={errors.title?.message}>
          <Input
            {...register('title', {
              required: 'Folder name is required',
              validate: validateFolderName,
            })}
            placeholder="Enter folder name"
            id="folder-name-input"
          />
        </Field>

        <Field label="Comment">
          <TextArea
            {...register('comment')}
            placeholder="Add a note to describe your changes (optional)"
            id="folder-comment-input"
            rows={5}
          />
        </Field>

        {isGitHub && (
          <>
            <Field label="Workflow">
              <Controller
                control={control}
                name="workflow"
                render={({ field: { ref, ...field } }) => (
                  <RadioButtonGroup {...field} options={getWorkflowOptions(repositoryConfig)} />
                )}
              />
            </Field>
            {workflow === 'branch' && (
              <Field
                label="Branch"
                description="Branch name in GitHub"
                invalid={!!errors?.ref}
                error={errors.ref ? <BranchValidationError /> : ''}
              >
                <Input {...register('ref', { validate: validateBranchName })} id="branch-name-input" />
              </Field>
            )}
          </>
        )}

        {prURL && (
          <Alert severity="info" title="Pull request created">
            A pull request has been created with changes to this folder:{' '}
            <a href={prURL} target="_blank" rel="noopener noreferrer">
              {prURL}
            </a>
          </Alert>
        )}

        <Stack gap={2}>
          <Button variant="secondary" fill="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={request.isLoading}>
            {request.isLoading ? 'Creating...' : 'Create'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

const BranchValidationError = () => {
  return (
    <>
      Invalid branch name.
      <ul style={{ padding: '0 20px' }}>
        <li>It cannot start with '/' or end with '/', '.', or whitespace.</li>
        <li>It cannot contain '//' or '..'.</li>
        <li>It cannot contain invalid characters: '~', '^', ':', '?', '*', '[', '\\', or ']'.</li>
        <li>It must have at least one valid character.</li>
      </ul>
    </>
  );
};
