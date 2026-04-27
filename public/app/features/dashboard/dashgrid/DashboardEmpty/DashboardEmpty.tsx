import { css } from '@emotion/css';
import { useCallback, useEffect } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Text, Box, Stack, TextLink, FilterPill, Tooltip } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { AddNewEditPane } from 'app/features/dashboard-scene/edit-pane/add-new/AddNewEditPane';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';

import { DashboardEmptyExtensionPoint } from './DashboardEmptyExtensionPoint';
import {
  useRepositoryStatus,
  useOnAddVisualization,
  useOnAddLibraryPanel,
  useOnImportDashboard,
} from './DashboardEmptyHooks';

interface InternalProps {
  dashboard: DashboardModel | DashboardScene;
  onAddVisualization?: () => void;
  onAddLibraryPanel?: () => void;
  onImportDashboard?: () => void;
}

const InternalDashboardEmpty = ({
  dashboard,
  onAddVisualization,
  onAddLibraryPanel,
  onImportDashboard,
}: InternalProps) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <Stack alignItems="center" justifyContent="center">
        <div className={`${styles.wrapper} ${styles.wrapperMaxWidth}`}>
          {config.featureToggles.dashboardNewLayouts && dashboard instanceof DashboardScene ? (
            <NewLayoutEmpty dashboard={dashboard} styles={styles} />
          ) : (
            <OldLayoutEmpty
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

interface NewLayoutEmptyProps {
  dashboard: DashboardScene;
  styles: {
    wrapper: string;
    wrapperMaxWidth: string;
    appsIcon: string;
  };
}

const NewLayoutEmpty = ({ dashboard, styles }: NewLayoutEmptyProps) => {
  const { uid, isEditing, editPane, body } = dashboard.useState();
  const isEditingNewDashboard = isEditing && !uid;
  const isAutoGrid = body instanceof AutoGridLayoutManager;

  // open the edit pane when the dashboard is new and in editing mode
  // will only happen when the default empty state is shown (not overridden by extension point)
  useEffect(() => {
    if (isEditingNewDashboard && editPane.state.openPane?.getId() !== 'add') {
      editPane.openPane(new AddNewEditPane({}));
    }
  }, [isEditingNewDashboard, editPane]);

  const onSelectAutoGrid = () => {
    dashboard.switchLayout(AutoGridLayoutManager.createEmpty());
    if (config.featureToggles.dashboardDefaultLayoutSelector) {
      dashboard.updateDefaultLayoutTemplate(AutoGridLayoutManager.createEmpty());
    }
  };

  const onSelectCustomGrid = () => {
    dashboard.switchLayout(DefaultGridLayoutManager.createEmpty());
    if (config.featureToggles.dashboardDefaultLayoutSelector) {
      dashboard.updateDefaultLayoutTemplate(DefaultGridLayoutManager.createEmpty());
    }
  };

  return (
    <Stack alignItems="stretch" justifyContent="center" gap={4} direction="column" width="100%">
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
        {config.featureToggles.dashboardDefaultLayoutSelector && (
          <>
            <Box marginTop={3} paddingX={4} display="flex" justifyContent="center" alignItems="center" gap={1}>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.select-layout-header">Select layout</Trans>
              </Text>
              <Tooltip
                placement="top"
                content={
                  <Trans i18nKey="dashboard.empty.layout-default-hint">
                    The selected layout will also be used as the default for all new tabs and rows. You can change this
                    later in Dashboard Settings &gt; General.
                  </Trans>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Box>
            <Box marginTop={1} display="flex" justifyContent="center">
              <Stack gap={1}>
                <FilterPill
                  label={t('dashboard.empty.auto-grid', 'Auto grid')}
                  selected={isAutoGrid}
                  onClick={onSelectAutoGrid}
                />
                <FilterPill
                  label={t('dashboard.empty.custom-grid', 'Custom grid')}
                  selected={!isAutoGrid}
                  onClick={onSelectCustomGrid}
                />
              </Stack>
            </Box>
            <Box marginTop={1} paddingX={4}>
              <Text element="p" textAlignment="center" color="secondary">
                {isAutoGrid
                  ? t('dashboard.empty.auto-grid-description', 'Panels resize to fit and form uniform grids')
                  : t('dashboard.empty.custom-grid-description', 'Position and size each panel individually')}
              </Text>
            </Box>
          </>
        )}
      </Box>
    </Stack>
  );
};

interface OldLayoutEmptyProps {
  onAddVisualization?: () => void;
  onAddLibraryPanel?: () => void;
  onImportDashboard?: () => void;
}
const OldLayoutEmpty = ({ onAddVisualization, onAddLibraryPanel, onImportDashboard }: OldLayoutEmptyProps) => (
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

export interface Props {
  dashboard: DashboardModel | DashboardScene;
  canCreate: boolean;
}

// We pass the default empty UI through to the extension point so that the extension can conditionally render it if needed.
// For example, an extension might want to render custom UI for a specific experiment cohort, and the default UI for everyone else.
const DashboardEmpty = (props: Props) => {
  const { isReadOnlyRepo, isProvisioned } = useRepositoryStatus(props);
  const onAddVisualization = useOnAddVisualization({ ...props, isReadOnlyRepo, isProvisioned });
  const onAddLibraryPanel = useOnAddLibraryPanel({ ...props, isReadOnlyRepo, isProvisioned });
  const onImportDashboard = useOnImportDashboard({ ...props, isReadOnlyRepo, isProvisioned });

  return (
    <DashboardEmptyExtensionPoint
      renderDefaultUI={useCallback(
        () => (
          <InternalDashboardEmpty
            dashboard={props.dashboard}
            onAddVisualization={onAddVisualization}
            onAddLibraryPanel={onAddLibraryPanel}
            onImportDashboard={onImportDashboard}
          />
        ),
        [onAddVisualization, onAddLibraryPanel, onImportDashboard, props.dashboard]
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
      width: '100%',

      [theme.breakpoints.up('sm')]: {
        paddingTop: theme.spacing(12),
      },
    }),
    wrapperMaxWidth: css({
      maxWidth: '890px',
    }),
    appsIcon: css({
      fill: theme.v1.palette.orange,
    }),
  };
}
