import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Button, Field, Input, LinkButton, RadioButtonGroup, Stack, TextArea } from '@grafana/ui';
import { AnnoKeyRepoName, AnnoKeyRepoPath } from 'app/features/apiserver/types';
import { DashboardMeta } from 'app/types';

import { useGetRepositoryQuery, useUpdateRepositoryFilesMutation } from '../../provisioning/api';
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
};

function getDefaultValues(meta: DashboardMeta) {
  const anno = meta.k8s?.annotations;
  let ref = '';
  let path = anno?.[AnnoKeyRepoPath] ?? '';
  const repo = anno?.[AnnoKeyRepoName] ?? '';
  const idx = path.indexOf('#');
  if (idx > 0) {
    ref = path.substring(idx + 1);
    path = path.substring(0, idx);
  }
  return {
    ref: ref || `dashboard/${Date.now()}`,
    path,
    repo,
    comment: '',
    workflow: WorkflowOption.Branch,
  };
}

function getWorkflowOptions(branch = 'main') {
  return [
    { label: `Commit to ${branch}`, value: WorkflowOption.Branch },
    { label: 'Create pull request', value: WorkflowOption.PullRequest },
  ];
}

export interface Props {
  meta: DashboardMeta;
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboard({ meta, drawer, changeInfo, dashboard }: Props) {
  const [saveDashboard, request] = useUpdateRepositoryFilesMutation();
  const defaultValues = getDefaultValues(meta);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    control,
  } = useForm({ defaultValues });
  const repositoryConfigQuery = useGetRepositoryQuery({ name: defaultValues.repo });
  const repositoryConfig = repositoryConfigQuery?.data?.spec;
  const isGitHub = repositoryConfig?.type === 'github';
  const [repo, ref, workflow] = watch(['repo', 'ref', 'workflow']);
  const href = createPRLink(repositoryConfig, repo, ref);

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
  }, [request.isSuccess, request.isError, request.error, dashboard]);

  const doSave = ({ ref, path, comment, repo }: FormData) => {
    if (!repo || !path) {
      return;
    }
    saveDashboard({ ref, name: repo, path, message: comment, body: changeInfo.changedSaveModel });
  };

  return (
    <form onSubmit={handleSubmit(doSave)}>
      <Stack direction="column" gap={2}>
        <div>
          <Alert severity="warning" title="Development feature">
            More warnings here... mostly exploratory interfaces.
          </Alert>
        </div>

        <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />

        <Field label="Repository">
          <Input {...register('repo')} readOnly />
        </Field>

        <Field label="Path" description="File path inside the repository. This must be .json or .yaml">
          <Input {...register('path')} readOnly />
        </Field>

        {isGitHub && (
          <>
            <Field label="Workflow">
              <Controller
                control={control}
                name={'workflow'}
                render={({ field: { ref, ...field } }) => (
                  <RadioButtonGroup {...field} options={getWorkflowOptions(repositoryConfig.github?.branch)} />
                )}
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

        <Field label="Comment">
          <TextArea
            {...register('comment')}
            aria-label="comment"
            placeholder="Add a note to describe your changes (optional)."
            autoFocus
            rows={5}
          />
        </Field>

        {workflow === WorkflowOption.PullRequest && dashboard.state.isDirty && (
          <Alert severity="warning" title="Unsaved changes">
            You have unsaved changes. Please save them before opening a pull request.
          </Alert>
        )}

        <Stack gap={2}>
          <Button variant="primary" type="submit" disabled={!dashboard.state.isDirty}>
            {request.isLoading ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={drawer.onClose} fill="outline">
            Cancel
          </Button>
          {isGitHub && workflow === WorkflowOption.PullRequest && (
            <LinkButton
              variant="secondary"
              href={href}
              fill="outline"
              target={'_blank'}
              rel={'noreferrer noopener'}
              disabled={dashboard.state.isDirty}
            >
              Open pull request
            </LinkButton>
          )}
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
