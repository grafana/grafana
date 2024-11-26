import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AppEvents, SelectableValue } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, Stack, TextArea, Field, Input, Alert, RadioButtonGroup } from '@grafana/ui';
import { AnnoKeyRepoName, AnnoKeyRepoPath } from 'app/features/apiserver/types';
import { DashboardMeta } from 'app/types';

import { useGetRepositoryQuery, useUpdateRepositoryFilesMutation } from '../../provisioning/api';
import { RepositorySpec } from '../../provisioning/api/types';
import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveDashboardFormCommonOptions } from './SaveDashboardForm';
import { DashboardChangeInfo } from './shared';

type FormData = {
  ref: string;
  path: string;
  comment?: string;
  repo: string;
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
  return { ref, path, repo, comment: '' };
}

function createPRLink(spec?: RepositorySpec, dashboardName?: string, ref?: string) {
  if (!spec || spec.type !== 'github' || !ref) {
    return '';
  }
  return `https://github.com/${spec.github?.owner}/${spec.github?.repository}/compare/${spec.github?.branch}...${ref}?quick_pull=1&labels=grafana&title=Update dashboard ${dashboardName}`;
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
  const { register, handleSubmit, watch, setValue } = useForm({ defaultValues });
  const repositoryConfigQuery = useGetRepositoryQuery({ name: defaultValues.repo });
  const repositoryConfig = repositoryConfigQuery?.data?.spec;
  const [workflow, setWorkflow] = useState<string>('main');
  const [repo, ref] = watch(['repo', 'ref']);
  const prhref = createPRLink(repositoryConfig, repo, ref);

  const workflowOptions = useMemo(() => {
    let options: Array<SelectableValue<string>> = [{
      label: `Write to repository`,
      value: 'main',
    }]
    if (repositoryConfig?.github) {
      options = [{
        label: `Commit to ${repositoryConfig?.github.branch ?? 'main'}`,
        value: 'main',
      }, {
        label: `Create pull request`,
        value: 'pr',
      }];
    }
    return options
  }, [repositoryConfig]);

  useEffect(() => {
    if (!workflow) {
      setWorkflow(workflowOptions[0].value!)
      return
    }
    if (workflow === 'pr') {
      setValue('ref', 'dashboard_pr_'+Date.now())
    }
  }, [workflow, workflowOptions, setValue])

  useEffect(() => {
    const appEvents = getAppEvents();
    if (request.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Dashboard saved'],
      });
      dashboard.setState({ isDirty: false });

      if (workflow === 'pr') {
        console.log("TODO, show Link in the UI...");
        alert('about to auto navigate...');
        window.open(
          prhref,
          '_blank' // <- This is what makes it open in a new window.
        );
      }

      // TODO Avoid full reload
      window.location.reload();
    } else if (request.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error saving dashboard', request.error],
      });
    }
  }, [request.isSuccess, request.isError, request.error, dashboard, workflow, prhref]);

  const doSave = ({ ref, path, comment, repo }: FormData) => {
    if (!repo || !path) {
      return;
    }

    saveDashboard({ ref, name: repo, path, message: comment, body: changeInfo.changedSaveModel });
  };

  console.log('RENDER', { defaultValues, meta })

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

        <Field label="Workflow">
          <RadioButtonGroup value={workflow} options={workflowOptions} onChange={v => setWorkflow(v)} />
        </Field>

        {workflow === 'pr' && (
          <Field label="Branch" description="Branch name in GitHub">
            <Input {...register('ref')} />
          </Field>
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

        <Stack gap={2}>
          {workflow === 'pr' ? (
            <Button variant="primary" type="submit">
            Open Pull Request
            </Button>
          ) : (<Button variant="primary" type="submit">
            Save
          </Button>)}

          <Button variant="secondary" onClick={drawer.onClose} fill="outline">
            Cancel
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
