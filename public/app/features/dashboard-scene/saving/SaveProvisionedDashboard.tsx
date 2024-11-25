import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { useCallback, useMemo } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { Button, ClipboardButton, Stack, Box } from '@grafana/ui';
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

export function SaveProvisionedDashboard({ meta, dashboard, drawer, changeInfo }: Props) {
  const dashboardJSON = useMemo(() => JSON.stringify(changeInfo.changedSaveModel, null, 2), [changeInfo]);

  const saveToFile = useCallback(() => {
    const blob = new Blob([dashboardJSON], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, changeInfo.changedSaveModel.title + '-' + new Date().getTime() + '.json');
  }, [changeInfo.changedSaveModel, dashboardJSON]);

  const { provisioning } = meta

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={2} grow={1}>
        <div>
          This dashboard cannot be saved from the Grafana UI because it has been provisioned from another source. Copy
          the JSON or save it to a file below, then you can update your dashboard in the provisioning source.
          <br />
          <i>
            See{' '}
            <a
              className="external-link"
              href="https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards"
              target="_blank"
              rel="noreferrer"
            >
              documentation
            </a>{' '}
            for more information about provisioning.
          </i>
          <br /> <br />
          <strong>File path: </strong> {dashboard.state.meta.provisionedExternalId}
        </div>

        <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />

        {provisioning ? <div>

          <div>
            <Button
              onClick={() => {
                getBackendSrv()
                  .put(provisioning.file, dashboardJSON, {
                    params: provisioning.ref ? { ref: provisioning.ref } : undefined,
                  })
                  .then((v) => {
                    console.log('WROTE', v);
                    alert('WROTE value');
                  });
              }}
            >
              SAVE
            </Button>
          </div>
        </div> : <div>
          <h1>Missing provisioning info</h1>
        </div>}



        <Box paddingTop={2}>
          <Stack gap={2}>
            <Button variant="secondary" onClick={drawer.onClose} fill="outline">
              Cancel
            </Button>
            <ClipboardButton icon="copy" getText={() => dashboardJSON}>
              Copy JSON to clipboard
            </ClipboardButton>
            <Button type="submit" onClick={saveToFile}>
              Save JSON to file
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
  json: css({
    flexGrow: 1,
    maxHeight: '800px',
  }),
};
