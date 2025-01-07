import debounce from 'debounce-promise';
import { ChangeEvent, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Button, Field, Icon, Input, RadioButtonGroup, Stack, TextArea, TextLink } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { AnnoKeyRepoName, AnnoKeyRepoPath } from 'app/features/apiserver/types';
import { DashboardMeta } from 'app/types';

import { validationSrv } from '../../manage-dashboards/services/ValidationSrv';
import { RepositorySpec } from '../../provisioning/api';
import { useCreateOrUpdateRepositoryFile, useFolderRepository, usePullRequestParam } from '../../provisioning/hooks';
import { WorkflowOption } from '../../provisioning/types';
import { createPRLink, validateBranchName } from '../../provisioning/utils/git';
import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveDashboardFormCommonOptions } from './SaveDashboardForm';
import { DashboardChangeInfo } from './shared';

type FormData = {
  ref: string;
  path: string;
  comment?: string;
  repo: string;
  workflow?: WorkflowOption;
  title: string;
  description: string;
  folder: { uid?: string; title?: string; repository?: string };
};

function getDefaultValues(meta: DashboardMeta, repository = '') {
  const anno = meta.k8s?.annotations;
  const timestamp = Date.now();
  const ref = `dashboard/${timestamp}`;
  const pathName = meta.slug || `new-dashboard-${timestamp}`;
  let path = anno?.[AnnoKeyRepoPath] ?? `${pathName}.json`;
  const repo = anno?.[AnnoKeyRepoName] ?? repository;
  const idx = path.indexOf('#');
  if (idx > 0) {
    path = path.substring(0, idx);
  }

  return {
    ref,
    path,
    repo,
    comment: '',
    folder: { uid: meta.folderUid, title: '', repository: '' },
  };
}

const getDefaultWorkflow = (config?: RepositorySpec) => {
  return config?.github?.branchWorkflow ? WorkflowOption.PullRequest : WorkflowOption.Branch;
};

function getWorkflowOptions(branch = 'main') {
  return [
    { label: `Commit to ${branch}`, value: WorkflowOption.Branch },
    { label: 'Create pull request', value: WorkflowOption.PullRequest },
  ];
}

export interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboard({ drawer, changeInfo, dashboard }: Props) {
  // Saving as a new provisioned dashboard
  const { saveProvisioned } = drawer.useState();
  const { meta, title: defaultTitle, description: defaultDescription } = dashboard.useState();
  const prURL = usePullRequestParam();
  const isNew = !meta.k8s?.annotations?.[AnnoKeyRepoPath];
  const folderRepository = useFolderRepository(meta.folderUid);
  const repositoryConfig = folderRepository?.spec;
  const repo = folderRepository?.metadata?.name;
  const defaultValues = getDefaultValues(meta, repo);
  const [action, request] = useCreateOrUpdateRepositoryFile(saveProvisioned || isNew ? undefined : defaultValues.path);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    control,
    setValue,
  } = useForm<FormData>({
    defaultValues: {
      ...defaultValues,
      title: defaultTitle,
      description: defaultDescription,
      workflow: WorkflowOption.PullRequest,
    },
  });
  const [title, ref, workflow, path, comment] = watch(['title', 'ref', 'workflow', 'path', 'comment']);
  const isGitHub = repositoryConfig?.type === 'github';
  const href = createPRLink(repositoryConfig, title, ref, comment);
  const { isDirty } = dashboard.state;
  const navigate = useNavigate();

  useEffect(() => {
    const appEvents = getAppEvents();
    if (request.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Dashboard saved'],
      });
      dashboard.setState({ isDirty: false });
    } else if (request.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error saving dashboard', request.error],
      });
    }
  }, [request.isSuccess, request.isError, request.error, dashboard, path, saveProvisioned, navigate, repo, ref]);

  useEffect(() => {
    setValue('workflow', getDefaultWorkflow(repositoryConfig));
  }, [repositoryConfig, setValue]);

  const doSave = async ({ ref, path, comment, repo, title, description }: FormData) => {
    if (!repo || !path) {
      return;
    }

    const saveModel = dashboard.getSaveAsModel({
      isNew: isNew,
      title: title,
      description: description,
    });

    if (workflow === WorkflowOption.Branch) {
      ref = repositoryConfig?.github?.branch || 'main';
    }

    action({ ref, name: repo, path, message: comment, body: saveModel });
  };

  return (
    <form onSubmit={handleSubmit(doSave)}>
      <Stack direction="column" gap={2}>
        {isGitHub && workflow === WorkflowOption.PullRequest && !isDirty && (
          <Alert
            severity="success"
            title="Branch successfully created"
            buttonContent={
              <Stack alignItems={'center'}>
                <span>Open pull request in GitHub</span>
                <Icon name="external-link-alt" />
              </Stack>
            }
            onRemove={() => {
              window.open(href, '_blank');
            }}
          >
            You can now open a pull request in Github.
          </Alert>
        )}
        {isNew && (
          <>
            <Field label={'Title'} invalid={!!errors.title} error={errors.title?.message}>
              <Input
                {...register('title', { required: 'Required', validate: validateDashboardName })}
                onChange={debounce(async (e: ChangeEvent<HTMLInputElement>) => {
                  setValue('title', e.target.value, { shouldValidate: true });
                }, 400)}
              />
            </Field>
            <Field label="Description" invalid={!!errors.description} error={errors.description?.message}>
              <TextArea {...register('description')} />
            </Field>

            <Field label={'Target folder'}>
              <Controller
                control={control}
                name={'folder'}
                render={({ field: { ref, value, onChange, ...field } }) => {
                  return (
                    <FolderPicker
                      onChange={(uid?: string, title?: string, repository?: string) => {
                        onChange({ uid, title, repository });
                        if (repository) {
                          setValue('repo', repository);
                        }
                        dashboard.setState({
                          meta: { k8s: { annotations: { [AnnoKeyRepoName]: repository } }, folderUid: uid },
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

        <Field label="Path" description="File path inside the repository. This must be .json or .yaml">
          <Input {...register('path')} readOnly={false} />
        </Field>

        <Field label="Comment">
          <TextArea
            {...register('comment')}
            aria-label="comment"
            placeholder="Add a note to describe your changes (optional)."
            autoFocus
            rows={5}
          />
        </Field>

        {isGitHub && (
          <>
            <Field label="Workflow">
              <Controller
                control={control}
                name={'workflow'}
                render={({ field: { ref, ...field } }) => {
                  return <RadioButtonGroup {...field} options={getWorkflowOptions(repositoryConfig.github?.branch)} />;
                }}
              />
            </Field>
            {workflow === WorkflowOption.PullRequest && (
              <Field
                label="Branch"
                description="Branch name in GitHub"
                invalid={!!errors?.ref}
                error={errors.ref ? <BranchValidationError /> : ''}
              >
                <Input {...register('ref', { validate: validateBranchName })} />
              </Field>
            )}
          </>
        )}

        {prURL && (
          <Alert severity="info" title="Pull request created">
            A pull request has been created with changes to this dashboard:{' '}
            <TextLink href={prURL} external>
              {prURL}
            </TextLink>
          </Alert>
        )}
        <Stack gap={2}>
          <Button variant="primary" type="submit" disabled={(request.isLoading || !isDirty) && !saveProvisioned}>
            {request.isLoading ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={drawer.onClose} fill="outline">
            Cancel
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

async function validateDashboardName(title: string, formValues: FormData) {
  if (title === formValues.folder.title?.trim()) {
    return 'Dashboard name cannot be the same as folder name';
  }

  try {
    await validationSrv.validateNewDashboardName(formValues.folder.uid ?? 'general', title);
    return true;
  } catch (e) {
    return e instanceof Error ? e.message : 'Dashboard name is invalid';
  }
}
