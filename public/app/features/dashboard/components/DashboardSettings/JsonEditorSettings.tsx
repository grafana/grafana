import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, CodeEditor, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';

import { getDashboardSrv } from '../../services/DashboardSrv';

import { SettingsPageProps } from './types';

export function JsonEditorSettings({ dashboard, sectionNav }: SettingsPageProps) {
  const dashboardSaveModel = dashboard.getSaveModelClone();
  const [dashboardJson, setDashboardJson] = useState<string>(JSON.stringify(dashboardSaveModel, null, 2));
  const pageNav = sectionNav.node.parentItem;

  const onClick = async () => {
    await getDashboardSrv().saveJSONDashboard(dashboardJson);
    dashboardWatcher.reloadPage();
  };

  const styles = useStyles2(getStyles);

  return (
    <Page navModel={sectionNav} pageNav={pageNav}>
      <div className={styles.wrapper}>
        <Trans i18nKey="dashboard-settings.json-editor.subtitle">
          The JSON model below is the data structure that defines the dashboard. This includes dashboard settings, panel
          settings, layout, queries, and so on.
        </Trans>
        <CodeEditor
          value={dashboardJson}
          language="json"
          showMiniMap={true}
          showLineNumbers={true}
          onBlur={setDashboardJson}
          containerStyles={styles.codeEditor}
        />
        {dashboard.meta.canSave && (
          <div>
            <Button type="submit" onClick={onClick}>
              <Trans i18nKey="dashboard-settings.json-editor.save-button">Save changes</Trans>
            </Button>
          </div>
        )}
      </div>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    height: '100%',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  codeEditor: css({
    flexGrow: 1,
  }),
});
