import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/PageNew/Page';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';

import { getDashboardSrv } from '../../services/DashboardSrv';

import { SettingsPageProps } from './types';

export function JsonEditorSettings({ dashboard, sectionNav }: SettingsPageProps) {
  const [dashboardJson, setDashboardJson] = useState<string>(JSON.stringify(dashboard.getSaveModelClone(), null, 2));

  const onClick = async () => {
    await getDashboardSrv().saveJSONDashboard(dashboardJson);
    dashboardWatcher.reloadPage();
  };

  const styles = useStyles2(getStyles);
  const subTitle =
    'The JSON model below is the data structure that defines the dashboard. This includes dashboard settings, panel settings, layout, queries, and so on';

  return (
    <Page navModel={sectionNav} subTitle={subTitle} pageInnerClass={styles.pageInner}>
      <CodeEditor
        value={dashboardJson}
        language="json"
        showMiniMap={true}
        showLineNumbers={true}
        onBlur={setDashboardJson}
        containerStyles={styles.container}
      />
      {dashboard.meta.canSave && (
        <Button type="submit" onClick={onClick} className={styles.saveButton}>
          Save changes
        </Button>
      )}
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pageInner: css({
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  }),
  container: css({
    borderRadius: theme.shape.borderRadius(),
    border: `1px solid ${theme.components.input.borderColor}`,
    flexGrow: 1,
  }),
  saveButton: css({
    alignSelf: 'flex-start',
    marginTop: theme.spacing(1),
  }),
});
