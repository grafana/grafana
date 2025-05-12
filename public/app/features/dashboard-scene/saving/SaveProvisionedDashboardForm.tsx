import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { useCallback, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Button, ClipboardButton, Stack, CodeEditor, Box, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

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
          <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cannot-be-saved">
            This dashboard cannot be saved from the Grafana UI because it has been provisioned from another source. Copy
            the JSON or save it to a file below, then you can update your dashboard in the provisioning source.
          </Trans>
          <br />
          <i>
            <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.see-docs">
              See{' '}
              <TextLink href="https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards" external>
                documentation
              </TextLink>{' '}
              for more information about provisioning.
            </Trans>
          </i>
          <br /> <br />
          <Trans
            i18nKey="dashboard-scene.save-provisioned-dashboard-form.file-path"
            values={{ filePath: dashboard.state.meta.provisionedExternalId }}
          >
            <strong>File path:</strong> {'{{filePath}}'}
          </Trans>
        </div>

        <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />

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
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cancel">Cancel</Trans>
            </Button>
            <ClipboardButton icon="copy" getText={() => dashboardJSON}>
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.copy-json-to-clipboard">
                Copy JSON to clipboard
              </Trans>
            </ClipboardButton>
            <Button type="submit" onClick={saveToFile}>
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.save-json-to-file">
                Save JSON to file
              </Trans>
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
