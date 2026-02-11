import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Box, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { DashboardEmptyExtensions } from './DashboardEmptyExtensions';
import { NewDashboardEmptyGridSelector } from './NewDashboardEmptyGridSelector';

interface NewLayoutEmptyProps {
  dashboard: DashboardScene;
  dashboardLibraryDatasourceUid: string | null;
}

export const NewDashboardEmpty = ({ dashboard, dashboardLibraryDatasourceUid }: NewLayoutEmptyProps) => {
  const styles = useStyles2(getStyles);
  const { uid, isEditing, editPane } = dashboard.useState();
  const isEditingNewDashboard = useMemo(() => isEditing && !uid, [isEditing, uid]);

  // open the edit pane when the dashboard is new and in editing mode
  // will only happen when the default empty state is shown (not overridden by extension point)
  useEffect(() => {
    if (isEditingNewDashboard) {
      editPane.openPane('add');
    }
  }, [isEditingNewDashboard, editPane]);

  return (
    <Stack alignItems="stretch" justifyContent="center" gap={4} direction="column">
      <Box padding={4}>
        <Box marginBottom={2} paddingX={4} display="flex" justifyContent="center">
          <Icon name="apps" size="xxl" className={styles.appsIcon} />
        </Box>
        <Text element="h1" textAlignment="center" weight="medium">
          <Trans i18nKey="dashboard.empty.title">New dashboard</Trans>
        </Text>
        <Box marginTop={3} paddingX={4}>
          <Text element="p" textAlignment="center" color="secondary">
            <Trans i18nKey="dashboard.empty.description">Add a panel to visualize your data</Trans>
          </Text>
        </Box>
      </Box>
      <NewDashboardEmptyGridSelector dashboard={dashboard} />
      <DashboardEmptyExtensions dashboardLibraryDatasourceUid={dashboardLibraryDatasourceUid} />
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  appsIcon: css({
    fill: theme.v1.palette.orange,
  }),
});
