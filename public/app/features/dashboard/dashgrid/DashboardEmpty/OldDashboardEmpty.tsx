import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Box, Button, Stack, Text, TextLink } from '@grafana/ui';

import { DashboardEmptyExtensions } from './DashboardEmptyExtensions';

interface OldDashboardEmptyProps {
  dashboardLibraryDatasourceUid: string | null;
  onAddVisualization?: () => void;
  onAddLibraryPanel?: () => void;
  onImportDashboard?: () => void;
}

export const OldDashboardEmpty = ({
  dashboardLibraryDatasourceUid,
  onAddVisualization,
  onAddLibraryPanel,
  onImportDashboard,
}: OldDashboardEmptyProps) => (
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
              Select a data source and then query and visualize your data with charts, stats and tables or create lists,
              markdowns and other widgets.
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

    <DashboardEmptyExtensions dashboardLibraryDatasourceUid={dashboardLibraryDatasourceUid} />

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
);
