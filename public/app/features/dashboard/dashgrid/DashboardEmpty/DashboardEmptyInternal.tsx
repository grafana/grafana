import { css, cx } from '@emotion/css';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Stack, useStyles2 } from '@grafana/ui';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { DashboardModel } from '../../state/DashboardModel';

import { NewDashboardEmpty } from './NewDashboardEmpty';
import { OldDashboardEmpty } from './OldDashboardEmpty';

interface DashboardEmptyInternalProps {
  dashboard: DashboardModel | DashboardScene;
  onAddVisualization?: () => void;
  onAddLibraryPanel?: () => void;
  onImportDashboard?: () => void;
}

export const DashboardEmptyInternal = ({
  dashboard,
  onAddVisualization,
  onAddLibraryPanel,
  onImportDashboard,
}: DashboardEmptyInternalProps) => {
  const styles = useStyles2(getStyles);
  const [searchParams] = useSearchParams();
  const dashboardLibraryDatasourceUid = searchParams.get('dashboardLibraryDatasourceUid');

  return (
    <>
      <Stack alignItems="center" justifyContent="center">
        <div
          className={cx(styles.wrapper, {
            [styles.wrapperMaxWidth]:
              !(config.featureToggles.dashboardLibrary || config.featureToggles.suggestedDashboards) ||
              !dashboardLibraryDatasourceUid,
          })}
        >
          {config.featureToggles.dashboardNewLayouts && dashboard instanceof DashboardScene ? (
            <NewDashboardEmpty dashboard={dashboard} dashboardLibraryDatasourceUid={dashboardLibraryDatasourceUid} />
          ) : (
            <OldDashboardEmpty
              dashboardLibraryDatasourceUid={dashboardLibraryDatasourceUid}
              onAddVisualization={onAddVisualization}
              onAddLibraryPanel={onAddLibraryPanel}
              onImportDashboard={onImportDashboard}
            />
          )}
        </div>
      </Stack>
    </>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      label: 'dashboard-empty-wrapper',
      flexDirection: 'column',
      gap: theme.spacing.gridSize * 4,
      paddingTop: theme.spacing(2),

      [theme.breakpoints.up('sm')]: {
        paddingTop: theme.spacing(12),
      },
    }),
    wrapperMaxWidth: css({
      maxWidth: '890px',
    }),
  };
}
