import { css, cx } from '@emotion/css';
import { useEffect, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Button, Spinner, ToolbarButton, useStyles2, useTheme2 } from '@grafana/ui';
import { MIN_SUGGESTIONS_PANE_WIDTH } from 'app/features/panel/suggestions/constants';

import { useEditPaneCollapsed } from '../edit-pane/shared';
import { getDashboardSceneFor } from '../utils/utils';

import { LibraryPanelEditModals } from './LibraryPanelEditModals';
import { PanelEditPanelWrapper } from './PanelEditPanelWrapper';
import { type PanelEditor } from './PanelEditor';
import { useSnappingSplitter } from './splitter/useSnappingSplitter';
import { useScrollReflowLimit } from './useScrollReflowLimit';

// v1 panel editor. PanelEditNext/PanelEditorRendererNext.tsx is the v2 version and renders the same
// PanelEditor scene, so anything the user can see here (modals, panes, toolbar actions) needs to
// exist there too until we drop v1.
export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane } = model.useState();
  const { controls } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const [isInitiallyCollapsed, setIsCollapsed] = useEditPaneCollapsed();

  const isScrollingLayout = useScrollReflowLimit();

  const theme = useTheme2();
  const panePadding = useMemo(() => +theme.spacing(2).replace(/px$/, ''), [theme]);
  const { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } =
    useSnappingSplitter({
      direction: 'row',
      dragPosition: 'end',
      initialSize: 330,
      usePixels: true,
      collapsed: isInitiallyCollapsed,
      collapseBelowPixels: MIN_SUGGESTIONS_PANE_WIDTH + panePadding,
      disabled: isScrollingLayout,
    });

  useEffect(() => {
    setIsCollapsed(splitterState.collapsed);
  }, [splitterState.collapsed, setIsCollapsed]);

  return (
    <div className={styles.pageContainer}>
      {controls && (
        <div className={styles.controlsWrapper}>
          <controls.Component model={controls} />
        </div>
      )}
      <div
        {...containerProps}
        className={cx(containerProps.className, styles.content)}
        data-testid={selectors.components.PanelEditor.General.content}
      >
        <div {...primaryProps} className={cx(primaryProps.className, styles.body)}>
          <VizAndDataPane model={model} />
        </div>
        <div {...splitterProps} />
        <div {...secondaryProps} className={cx(secondaryProps.className, styles.optionsPane)}>
          {splitterState.collapsed && (
            <div className={styles.expandOptionsWrapper}>
              <ToolbarButton
                tooltip={t('dashboard-scene.panel-editor-renderer.tooltip-open-options-pane', 'Open options pane')}
                icon={'arrow-to-right'}
                onClick={onToggleCollapse}
                variant="canvas"
                className={styles.rotate180}
                aria-label={t(
                  'dashboard-scene.panel-editor-renderer.aria-label-open-options-pane',
                  'Open options pane'
                )}
              />
            </div>
          )}
          {!splitterState.collapsed && optionsPane && <optionsPane.Component model={optionsPane} />}
          {!splitterState.collapsed && !optionsPane && <Spinner />}
        </div>
      </div>
    </div>
  );
}

function VizAndDataPane({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { dataPane, tableView } = model.useState();
  const panel = model.getPanel();
  const styles = useStyles2(getStyles);

  const isScrollingLayout = useScrollReflowLimit();

  const { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } =
    useSnappingSplitter({
      direction: 'column',
      dragPosition: 'start',
      initialSize: 0.5,
      collapseBelowPixels: 150,
      disabled: isScrollingLayout,
    });

  containerProps.className = cx(containerProps.className, styles.vizAndDataPane);

  if (!dataPane && !isScrollingLayout) {
    primaryProps.style.flexGrow = 1;
  }

  primaryProps.className = cx(primaryProps.className, styles.viz, isScrollingLayout && styles.fixedSizeViz);

  return (
    <div {...containerProps}>
      <div {...primaryProps} className={cx(primaryProps.className, isScrollingLayout && styles.fixedSizeViz)}>
        <PanelEditPanelWrapper panel={panel} tableView={tableView} dashboard={dashboard} />
      </div>
      <LibraryPanelEditModals model={model} />
      {dataPane && (
        <>
          <div {...splitterProps} />
          <div {...secondaryProps} className={cx(secondaryProps.className, isScrollingLayout && styles.fullSizeEditor)}>
            {splitterState.collapsed && (
              <div className={styles.expandDataPane}>
                <Button
                  tooltip={t('dashboard-scene.viz-and-data-pane.tooltip-open-query-pane', 'Open query pane')}
                  icon={'arrow-to-right'}
                  onClick={onToggleCollapse}
                  variant="secondary"
                  size="sm"
                  className={styles.openDataPaneButton}
                  aria-label={t('dashboard-scene.viz-and-data-pane.aria-label-open-query-pane', 'Open query pane')}
                />
              </div>
            )}
            {/* @ts-expect-error - dataPane is a union type of PanelDataPane and PanelDataPaneNext */}
            {!splitterState.collapsed && <dataPane.Component model={dataPane} />}
          </div>
        </>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    pageContainer: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flex: '1 1 0',
      minHeight: 0,
      position: 'relative',
    }),
    vizAndDataPane: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flex: '1 1 0',
      minHeight: 0,
    }),
    canvasContent: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      flexBasis: '100%',
      flexGrow: 1,
      minHeight: 0,
      width: '100%',
    }),
    content: css({
      width: '100%',
      overflow: 'hidden',
      flexGrow: 1,
      [theme.breakpoints.down('sm')]: {
        overflow: 'unset',
      },
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      position: 'relative',
    }),
    optionsPane: css({
      flexDirection: 'column',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderTopLeftRadius: theme.shape.radius.default,
    }),
    expandOptionsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 1),
    }),
    expandDataPane: css({
      display: 'flex',
      flexDirection: 'row',
      padding: theme.spacing(1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      flexGrow: 1,
      justifyContent: 'space-around',
    }),
    rotate180: css({
      rotate: '180deg',
    }),
    controlsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 0,
      gridArea: 'controls',
    }),
    openDataPaneButton: css({
      width: theme.spacing(8),
      justifyContent: 'center',
      svg: {
        rotate: '-90deg',
      },
    }),
    viz: css({
      paddingLeft: theme.spacing(2),
    }),
    fixedSizeViz: css({
      height: '100vh',
    }),
    fullSizeEditor: css({
      height: 'max-content',
    }),
  };
}
