import { css, cx } from '@emotion/css';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack, TextLink } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { BasicProvisionedDashboardsEmptyPage } from '../DashboardLibrary/BasicProvisionedDashboardsEmptyPage';
import { SuggestedDashboards } from '../DashboardLibrary/SuggestedDashboards';

import { DashboardEmptyExtensionPoint } from './DashboardEmptyExtensionPoint';
import {
  useIsReadOnlyRepo,
  useOnAddVisualization,
  useOnAddLibraryPanel,
  useOnImportDashboard,
} from './DashboardEmptyHooks';

interface InternalProps {
  onAddVisualization?: () => void;
  onAddLibraryPanel?: () => void;
  onImportDashboard?: () => void;
}

const InternalDashboardEmpty = ({ onAddVisualization, onAddLibraryPanel, onImportDashboard }: InternalProps) => {
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
          <Stack alignItems="stretch" justifyContent="center" gap={4} direction="column">
            <Box borderRadius="lg" borderColor="strong" borderStyle="dashed" padding={4}>
              <Stack direction="column" alignItems="center" gap={2}>
                <Text element="h1" textAlignment="center" weight="medium">
                  <Trans i18nKey="dashboard.empty.add-visualization-header">
                    Start your new dashboard by adding a visualization
                  </Trans>
                </Text>
                <Box marginBottom={2} paddingX={4}>
                  <Text element="p" textAlignment="center" color="secondary">
                    <Trans i18nKey="dashboard.empty.add-visualization-body">
                      Select a data source and then query and visualize your data with charts, stats and tables or
                      create lists, markdowns and other widgets.
                    </Trans>
                  </Text>
                </Box>
                <Button
                  size="lg"
                  icon="plus"
                  data-testid={selectors.pages.AddDashboard.itemButton('Create new panel button')}
                  onClick={onAddVisualization}
                  disabled={!onAddVisualization}
                >
                  <Trans i18nKey="dashboard.empty.add-visualization-button">Add visualization</Trans>
                </Button>
              </Stack>
            </Box>

            {/* Suggested Dashboards Section */}
            {config.featureToggles.suggestedDashboards &&
              !config.featureToggles.dashboardLibrary &&
              dashboardLibraryDatasourceUid && <SuggestedDashboards datasourceUid={dashboardLibraryDatasourceUid} />}

            {/* Basic Provisioned Dashboards Section that don't include community dashboards */}
            {config.featureToggles.dashboardLibrary &&
              !config.featureToggles.suggestedDashboards &&
              dashboardLibraryDatasourceUid && (
                <BasicProvisionedDashboardsEmptyPage datasourceUid={dashboardLibraryDatasourceUid} />
              )}

            <Stack direction={{ xs: 'column', md: 'row' }} wrap="wrap" gap={4}>
              <Box borderRadius="lg" borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
                <Stack direction="column" alignItems="center" gap={1}>
                  <Text element="h3" textAlignment="center" weight="medium">
                    <Trans i18nKey="dashboard.empty.add-library-panel-header">Import panel</Trans>
                  </Text>
                  <Box marginBottom={2}>
                    <Text element="p" textAlignment="center" color="secondary">
                      <Trans i18nKey="dashboard.empty.add-library-panel-body">
                        Add visualizations that are shared with other dashboards.
                      </Trans>
                    </Text>
                  </Box>
                  <Button
                    icon="plus"
                    fill="outline"
                    data-testid={selectors.pages.AddDashboard.itemButton('Add a panel from the panel library button')}
                    onClick={onAddLibraryPanel}
                    disabled={!onAddLibraryPanel}
                  >
                    <Trans i18nKey="dashboard.empty.add-library-panel-button">Add library panel</Trans>
                  </Button>
                </Stack>
              </Box>
              <Box borderRadius="lg" borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
                <Stack direction="column" alignItems="center" gap={1}>
                  <Text element="h3" textAlignment="center" weight="medium">
                    <Trans i18nKey="dashboard.empty.import-a-dashboard-header">Import a dashboard</Trans>
                  </Text>
                  <Box marginBottom={2}>
                    <Text element="p" textAlignment="center" color="secondary">
                      <Trans i18nKey="dashboard.empty.import-a-dashboard-body">
                        Import dashboards from files or{' '}
                        <TextLink external href="https://grafana.com/grafana/dashboards/">
                          grafana.com
                        </TextLink>
                        .
                      </Trans>
                    </Text>
                  </Box>
                  <Button
                    icon="upload"
                    fill="outline"
                    data-testid={selectors.pages.AddDashboard.itemButton('Import dashboard button')}
                    onClick={onImportDashboard}
                    disabled={!onImportDashboard}
                  >
                    <Trans i18nKey="dashboard.empty.import-dashboard-button">Import dashboard</Trans>
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Stack>
        </div>
      </Stack>
    </>
  );
};

export interface Props {
  dashboard: DashboardModel | DashboardScene;
  canCreate: boolean;
}

// We pass the default empty UI through to the extension point so that the extension can conditionally render it if needed.
// For example, an extension might want to render custom UI for a specific experiment cohort, and the default UI for everyone else.
const DashboardEmpty = (props: Props) => {
  const isReadOnlyRepo = useIsReadOnlyRepo(props);
  const onAddVisualization = useOnAddVisualization({ ...props, isReadOnlyRepo });
  const onAddLibraryPanel = useOnAddLibraryPanel({ ...props, isReadOnlyRepo });
  const onImportDashboard = useOnImportDashboard({ ...props, isReadOnlyRepo });

  return (
    <DashboardEmptyExtensionPoint
      renderDefaultUI={useCallback(
        () => (
          <InternalDashboardEmpty
            onAddVisualization={onAddVisualization}
            onAddLibraryPanel={onAddLibraryPanel}
            onImportDashboard={onImportDashboard}
          />
        ),
        [onAddVisualization, onAddLibraryPanel, onImportDashboard]
      )}
      onAddVisualization={onAddVisualization}
      onAddLibraryPanel={onAddLibraryPanel}
      onImportDashboard={onImportDashboard}
    />
  );
};

export default DashboardEmpty;

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
