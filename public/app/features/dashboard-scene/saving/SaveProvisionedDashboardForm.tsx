import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import React, { useCallback, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Button, ClipboardButton, Stack, CodeEditor, Box } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveDashboardFormCommonOptions } from './SaveDashboardForm';
import { DashboardChangeInfo } from './shared';

export interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboardForm({ dashboard, drawer, changeInfo }: Props) {
  const dashboardJSON = useMemo(() => JSON.stringify(changeInfo.changedSaveModel, null, 2), [changeInfo]);

  const saveToFile = useCallback(() => {
    const blob = new Blob([dashboardJSON], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, changeInfo.changedSaveModel.title + '-' + new Date().getTime() + '.json');
  }, [changeInfo.changedSaveModel, dashboardJSON]);

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
        <Stack direction="column" gap={0}>
          <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />
        </Stack>
        <div className={styles.json}>
          <AutoSizer disableWidth>
            {({ height }) => (
              <CodeEditor
                width="100%"
                height={height}
                language="json"
                showLineNumbers={true}
                showMiniMap={dashboardJSON.length > 100}
                value={dashboardJSON}
                readOnly={true}
              />
            )}
          </AutoSizer>
        </div>
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
