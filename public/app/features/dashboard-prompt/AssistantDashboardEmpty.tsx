import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Box, Button, Combobox, type ComboboxOption, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';

import { DashboardLandingPrompt } from './DashboardLandingPrompt';
import { getPromptDatasources } from './datasources';
import { startPlanningInAssistant } from './handoff';
import { type DashboardLandingPromptSelection } from './types';

interface Props {
  dashboard: DashboardScene;
}

type LayoutValue = 'auto' | 'custom';

export function AssistantDashboardEmpty({ dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const gridLabelId = useId();
  const { sidebar, body } = dashboard.useState();
  const isAutoGrid = body instanceof AutoGridLayoutManager;
  // Set at scene activation when the URL has editSource=assistant (modal /
  // create_dashboard), or on submit from this landing so the same session
  // tag applies without a remount.
  const [assistantDriven, setAssistantDriven] = useState(() => dashboard.getEditSessionSource() === 'assistant');

  const onSelectAutoGrid = () => {
    dashboard.switchLayout(AutoGridLayoutManager.createEmpty());
    dashboard.updateDefaultLayoutTemplate(AutoGridLayoutManager.createEmpty());
  };

  const onSelectCustomGrid = () => {
    dashboard.switchLayout(DefaultGridLayoutManager.createEmpty());
    dashboard.updateDefaultLayoutTemplate(DefaultGridLayoutManager.createEmpty());
  };

  const onLayoutChange = (option: ComboboxOption<LayoutValue>) => {
    if (option.value === 'auto') {
      onSelectAutoGrid();
      return;
    }
    onSelectCustomGrid();
  };

  const onAddVisualization = () => {
    sidebar.addNewPanel(sidebar.getSelectedObject());
  };

  const onSubmitPrompt = useCallback(
    (prompt: string, selection: DashboardLandingPromptSelection[]) => {
      const selectedDatasources = selection
        .filter((item) => item.kind === 'datasource')
        .map((item) => ({
          uid: item.uid,
          type: item.datasourceType ?? 'unknown',
          name: item.name,
        }));
      const dashboards = selection
        .filter((item) => item.kind === 'dashboard')
        .map((item) => ({ uid: item.uid, title: item.name }));

      const started = startPlanningInAssistant({
        request: prompt,
        displayPrompt: prompt,
        datasources: selectedDatasources.length > 0 ? selectedDatasources : getPromptDatasources(),
        dashboards,
        folderUid: dashboard.state.meta.folderUid,
        skipNavigation: true,
      });

      if (started) {
        // Already in edit mode as a user session (new dashboards auto-enter on
        // activation). Re-tag so the Add pane stays closed and the canvas
        // matches a planning session that landed via editSource=assistant.
        dashboard.onEnterEditMode('assistant');
        setAssistantDriven(true);
        reportInteraction('dashboard_prompt_planning_started', { source: 'empty_dashboard' });
      }
    },
    [dashboard]
  );

  useEffect(() => {
    if (!assistantDriven) {
      return;
    }
    if (sidebar.state.openPane?.getId() === 'add') {
      sidebar.closePane();
    }
  }, [assistantDriven, sidebar]);

  const layoutOptions: Array<ComboboxOption<LayoutValue>> = [
    { label: t('dashboard.empty.grid-auto', 'Auto'), value: 'auto' },
    { label: t('dashboard.empty.grid-custom', 'Custom'), value: 'custom' },
  ];

  return (
    <div className={styles.root}>
      <div className={cx(assistantDriven && styles.dimmed)} inert={assistantDriven}>
        <Stack alignItems="stretch" justifyContent="center" direction="column" gap={4} width="100%">
          <Stack alignItems="center" direction="column" gap={2}>
            <div className={styles.appsIconWrap}>
              <Icon name="apps" size="xxl" className={styles.appsIcon} />
            </div>
            <div className={styles.prompt}>
              <DashboardLandingPrompt onSubmit={onSubmitPrompt} />
            </div>
          </Stack>

          <Stack alignItems="center" height={4}>
            <div className={styles.orLine} />
            <Text color="secondary">
              <Trans i18nKey="dashboard.empty.or-start-blank">Or start blank</Trans>
            </Text>
            <div className={styles.orLine} />
          </Stack>

          <div>
            <Text element="h2" variant="h5" weight="medium">
              <Trans i18nKey="dashboard.empty.add-visualization-heading">Add a visualization</Trans>
            </Text>
            <Box marginTop={0.5} marginBottom={2}>
              <Text element="p" variant="bodySmall" color="secondary">
                <Trans i18nKey="dashboard.empty.add-visualization-description">
                  Visualizations are panels for your data. Organize them with Auto grid or Custom grid.
                </Trans>
              </Text>
            </Box>
            <Stack alignItems="center" gap={1}>
              <Button
                size="sm"
                icon="plus"
                variant="secondary"
                data-testid={selectors.pages.AddDashboard.itemButton('Create new panel button')}
                onClick={onAddVisualization}
              >
                <Trans i18nKey="dashboard.empty.add-visualization-button">Add visualization</Trans>
              </Button>
              <Text element="span" variant="bodySmall" color="secondary" id={gridLabelId}>
                <Trans i18nKey="dashboard.empty.grid-label">Grid:</Trans>
              </Text>
              <Combobox
                options={layoutOptions}
                value={isAutoGrid ? 'auto' : 'custom'}
                onChange={onLayoutChange}
                width="auto"
                minWidth={12}
                aria-labelledby={gridLabelId}
              />
            </Stack>
          </div>
        </Stack>
      </div>
      {assistantDriven && (
        <div className={styles.interactionLock} data-testid="dashboard-assistant-interaction-lock" role="presentation">
          <Spinner size="xl" />
        </div>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '100%',
    }),
    dimmed: css({
      opacity: 0.25,
    }),
    interactionLock: css({
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'default',
    }),
    appsIconWrap: css({
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
    }),
    appsIcon: css({
      fill: theme.v1.palette.orange,
    }),
    prompt: css({
      width: '100%',
    }),
    orLine: css({
      flex: 1,
      height: 1,
      background: theme.colors.border.weak,
    }),
  };
}
