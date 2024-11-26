import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, Stack, TextArea, Field, Input, Alert, LinkButton } from '@grafana/ui';
import { AnnoKeyRepoName, AnnoKeyRepoPath } from 'app/features/apiserver/types';
import { DashboardMeta } from 'app/types';

import { useGetRepositoryQuery, useUpdateRepositoryFilesMutation } from '../../provisioning/api';
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
  } = useForm({ defaultValues });
  const repositoryConfigQuery = useGetRepositoryQuery({ name: defaultValues.repo });
  const repositoryConfig = repositoryConfigQuery?.data?.spec;
  const isGitHub = repositoryConfig?.type === 'github';
  const [repo, ref] = watch(['repo', 'ref']);
  const href = createPRLink(repositoryConfig, repo, ref);

  useEffect(() => {
    const appEvents = getAppEvents();
    if (request.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Dashboard saved'],
      });
      dashboard.setState({ isDirty: false });
      // TODO Avoid full reload
      window.location.reload();
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
          <Input {...register('path')} />
        </Field>

        {isGitHub && (
          <Field
            label="Branch"
            description="Branch name in GitHub"
            invalid={!!errors?.ref}
            error={errors.ref ? <BranchValidationError /> : ''}
          >
            <Input {...register('ref', { validate: validateBranchName })} />
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
          <Button variant="primary" type="submit">
            Save
          </Button>
          <Button variant="secondary" onClick={drawer.onClose} fill="outline">
            Cancel
          </Button>
          {isGitHub && (
            <LinkButton variant="secondary" href={href} fill="outline" target={'_blank'} rel={'noreferrer noopener'}>
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
