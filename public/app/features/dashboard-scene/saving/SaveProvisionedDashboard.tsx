import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, Stack, Box, TextArea, Field, Input, Alert } from '@grafana/ui';
import { AnnoKeyRepoName, AnnoKeyRepoPath } from 'app/features/apiserver/types';
import { DashboardMeta } from 'app/types';

import { useConnectPutRepositoryFilesMutation } from '../../provisioning/api';
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
  const [saveDashboard, request] = useConnectPutRepositoryFilesMutation();
  const { register, handleSubmit } = useForm({ defaultValues: getDefaultValues(meta) });

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
    // @ts-expect-error TODO Add ref param
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

        <Field label="Branch" description="Only supported by GitHub right now">
          <Input {...register('ref')} />
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

        <Box paddingTop={2}>
          <Stack gap={2}>
            <Button variant="primary" type="submit">
              Save
            </Button>
            <Button variant="secondary" onClick={drawer.onClose} fill="outline">
              Cancel
            </Button>
          </Stack>
        </Box>
      </Stack>
    </form>
  );
}
