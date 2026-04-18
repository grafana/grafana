import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Alert, Box, Icon, IconButton, RadioButtonGroup, Tooltip, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardRulesFlowEditor } from './DashboardRulesFlowEditor';
import { RulesBuilderView } from './RulesBuilderView';
import { RulesJsonViewer } from './RulesJsonViewer';
import { RulesSimulator } from './RulesSimulator';
import { RulesSplitView } from './RulesSplitView';
import { RulesTableView } from './RulesTableView';
import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

type ViewMode = 'table' | 'split' | 'builder' | 'simulator';

const viewModeOptions = [
  { label: 'Flow', value: 'split' as const, icon: 'diagram-3' as const },
  { label: 'Builder', value: 'builder' as const, icon: 'edit' as const },
  { label: 'Simulator', value: 'simulator' as const, icon: 'process' as const },
  { label: 'Table', value: 'table' as const, icon: 'table' as const },
];

export class DashboardRulesEditView extends SceneObjectBase<DashboardEditViewState> implements DashboardEditView {
  static Component = DashboardRulesEditViewRenderer;

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'rules';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }
}

function DashboardRulesEditViewRenderer({ model }: SceneComponentProps<DashboardRulesEditView>) {
  const dashboard = model.getDashboard();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const styles = useStyles2(getStyles);

  const isFeatureEnabled = config.featureToggles.dashboardRules;

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showJson, setShowJson] = useState(false);
  const [simulatedActiveRules, setSimulatedActiveRules] = useState<Set<number> | undefined>(undefined);

  const containerRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number | undefined>(undefined);

  const measureHeight = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const top = el.getBoundingClientRect().top;
    setAvailableHeight(window.innerHeight - top);
  }, []);

  useEffect(() => {
    measureHeight();
    window.addEventListener('resize', measureHeight);
    return () => window.removeEventListener('resize', measureHeight);
  }, [measureHeight]);

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      {!isFeatureEnabled ? (
        <Box padding={2}>
          <Alert severity="info" title="Rules">
            Rules are not enabled. Enable the dashboardRules feature toggle to use this feature.
          </Alert>
        </Box>
      ) : (
        <div
          ref={containerRef}
          className={styles.container}
          style={availableHeight ? { height: availableHeight } : undefined}
        >
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <RadioButtonGroup size="sm" options={viewModeOptions} value={viewMode} onChange={setViewMode} />

            <div className={styles.toolbarDivider} />

            <Tooltip content={showJson ? 'Hide JSON' : 'Show JSON'}>
              <IconButton
                name="brackets-curly"
                size="md"
                tooltip=""
                variant={showJson ? 'primary' : 'secondary'}
                onClick={() => setShowJson(!showJson)}
              />
            </Tooltip>

            <div className={styles.toolbarSpacer} />
            <span className={styles.toolbarLabel}>
              <Icon name="cog" size="sm" />
              Rules
            </span>
          </div>

          {/* Main content area */}
          <div className={styles.contentArea}>
            {/* Active view */}
            <div className={styles.mainArea}>
              {viewMode === 'table' && <RulesTableView dashboard={dashboard} />}

              {viewMode === 'split' && <RulesSplitView dashboard={dashboard} />}

              {viewMode === 'builder' && <RulesBuilderView dashboard={dashboard} />}

              {viewMode === 'simulator' && (
                <div className={styles.simulatorLayout}>
                  <div className={styles.simulatorPanel}>
                    <RulesSimulator
                      dashboard={dashboard}
                      onSelectScenario={setSimulatedActiveRules}
                      selectedRules={simulatedActiveRules}
                    />
                  </div>
                  <div className={styles.simulatorFlowPreview}>
                    <DashboardRulesFlowEditor
                      dashboard={dashboard}
                      simulatedActiveRules={simulatedActiveRules}
                      readOnly
                    />
                  </div>
                </div>
              )}
            </div>

            {/* JSON panel (available in all modes) */}
            {showJson && (
              <div className={styles.jsonPanel}>
                <RulesJsonViewer dashboard={dashboard} />
              </div>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }),
    toolbar: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
      borderRadius: `${theme.shape.radius.default} ${theme.shape.radius.default} 0 0`,
      flexShrink: 0,
    }),
    toolbarDivider: css({
      width: 1,
      height: 20,
      background: theme.colors.border.weak,
    }),
    toolbarSpacer: css({
      flex: 1,
    }),
    toolbarLabel: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    contentArea: css({
      display: 'flex',
      flexDirection: 'row',
      flex: 1,
      overflow: 'hidden',
      minHeight: 0,
    }),
    mainArea: css({
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
      minWidth: 0,
      minHeight: 0,
    }),
    simulatorLayout: css({
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
    }),
    simulatorPanel: css({
      width: 360,
      minWidth: 300,
      flexShrink: 0,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      overflow: 'auto',
      background: theme.colors.background.primary,
    }),
    simulatorFlowPreview: css({
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    }),
    jsonPanel: css({
      width: 400,
      flexShrink: 0,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      overflow: 'hidden',
    }),
  };
}
