import { css } from '@emotion/css';
import React, { useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/PageNew/Page';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';

import { getDashboardSrv } from '../../services/DashboardSrv';

import { SettingsPageProps } from './types';

export function JsonEditorSettings({ dashboard, sectionNav }: SettingsPageProps) {
  const [dashboardJson, setDashboardJson] = useState<string>(JSON.stringify(dashboard.getSaveModelClone(), null, 2));
  const onBlur = (value: string) => {
    setDashboardJson(value);
  };

  const onClick = () => {
    getDashboardSrv()
      .saveJSONDashboard(dashboardJson)
      .then(() => {
        dashboardWatcher.reloadPage();
      });
  };

  const styles = useStyles2(getStyles);
  const subTitle =
    'The JSON model below is the data structure that defines the dashboard. This includes dashboard settings, panel settings, layout, queries, and so on';

  return (
    <Page navModel={sectionNav} subTitle={subTitle}>
      <div className="dashboard-settings__subheader"></div>

      <Stack direction="column" gap={4} flexGrow={1}>
        <div className={styles.editWrapper}>
          <AutoSizer>
            {({ width, height }) => (
              <CodeEditor
                value={dashboardJson}
                language="json"
                width={width}
                height={height}
                showMiniMap={true}
                showLineNumbers={true}
                onBlur={onBlur}
              />
            )}
          </AutoSizer>
        </div>
        <div>
          {dashboard.meta.canSave && (
            <Button type="submit" onClick={onClick}>
              Save changes
            </Button>
          )}
        </div>
      </Stack>
    </Page>
  );
}

const getStyles = (_: GrafanaTheme2) => ({
  editWrapper: css({ flexGrow: 1 }),
});
