import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { config, getBackendSrv } from '@grafana/runtime';
import { Button, Stack, Box, TextArea, Field, Input, Alert } from '@grafana/ui';
import { AnnoKeyRepoName, AnnoKeyRepoPath } from 'app/features/apiserver/types';
import { DashboardMeta } from 'app/types';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveDashboardFormCommonOptions } from './SaveDashboardForm';
import { DashboardChangeInfo } from './shared';

export interface Props {
  meta: DashboardMeta;
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboard({ meta, drawer, changeInfo }: Props) {
  const dashboardJSON = useMemo(() => JSON.stringify(changeInfo.changedSaveModel, null, 2), [changeInfo]);

  const [repo, setRepo] = useState<string>();
  const [path, setPath] = useState<string>();
  const [ref, setRef] = useState<string>();
  const [comment, setComment] = useState<string>();

  useEffect(() => {
    const anno = meta.k8s?.annotations;
    if (!anno) {
      setRepo('');
      setPath('');
      setRef('');
      return;
    }
    let ref = '';
    let path = anno[AnnoKeyRepoPath] ?? '';
    const idx = path.indexOf('#');
    if (idx > 0) {
      ref = path.substring(idx + 1);
      path = path.substring(0, idx);
    }
    setRepo(anno[AnnoKeyRepoName]);
    setPath(path);
    setRef(ref);
  }, [meta]);

  const doSave = () => {
    const url = `apis/provisioning.grafana.app/v0alpha1/namespaces/${config.namespace}/repositories/${repo}/files/${path}`;
    const params: Record<string, string> = {};
    if (ref) {
      params['ref'] = ref;
    }
    if (comment) {
      params['comment'] = comment;
    }

    getBackendSrv()
      .put(url, dashboardJSON, { params })
      .then((v) => {
        console.log('WROTE', v);
        alert('WROTE value');
      });
  };

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={2} grow={1}>
        <div>
          <Alert severity="warning" title="Development feature">
            More warnings here... mostly exploratory interfaces.
          </Alert>
        </div>

        <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />

        <Field label="Repository">
          <div>{repo}</div>
        </Field>

        <Field label="Path" description="File path inside the repository. This must be .json or .yaml">
          <Input
            value={path}
            onChange={(e) => {
              setPath(e.currentTarget.value);
            }}
          />
        </Field>

        <Field label="Branch" description="only supported by github right now">
          <Input
            value={ref}
            onChange={(e) => {
              setRef(e.currentTarget.value);
            }}
          />
        </Field>

        <Field label="Comment">
          <TextArea
            aria-label="comment"
            value={comment ?? ''}
            onChange={(e) => {
              setComment(e.currentTarget.value);
            }}
            placeholder="Add a note to describe your changes (optional)."
            autoFocus
            rows={5}
          />
        </Field>

        <Box paddingTop={2}>
          <Stack gap={2}>
            <Button variant="primary" onClick={doSave}>
              Save
            </Button>
            <Button variant="secondary" onClick={drawer.onClose} fill="outline">
              Cancel
            </Button>
          </Stack>
        </Box>
      </Stack>
    </div>
  );
}

const styles = {
  container: css({
    height: '100%',
    display: 'flex',
  }),
};
