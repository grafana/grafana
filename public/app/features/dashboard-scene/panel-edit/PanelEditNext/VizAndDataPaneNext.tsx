import { css, cx } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Button, ToolbarButton, useStyles2 } from '@grafana/ui';

import { PanelEditPanelWrapper } from '../PanelEditPanelWrapper';
import { type PanelEditor } from '../PanelEditor';
import { QueryEditorBanner } from '../QueryEditorBanner';

import { PanelDataPaneNext } from './PanelDataPaneNext';
import { QueryEditorContextWrapper } from './QueryEditor/QueryEditorContextWrapper';
import { Sidebar } from './QueryEditor/Sidebar/Sidebar';
import { SidebarSize } from './constants';
import { useQueryEditorBanner, useVizAndDataPaneLayout } from './hooks';

export function VizAndDataPaneNext({ model }: SceneComponentProps<PanelEditor>) {
  const { showBanner, dismissBanner } = useQueryEditorBanner();
  const { scene, sidebarSize, setSidebarSize, isScrollingLayout, vizDataSplitter, sidebarSplitter } =
    useVizAndDataPaneLayout(model);
  const styles = useStyles2(getStyles, sidebarSize);

  const nextDataPane = scene.dataPane instanceof PanelDataPaneNext ? scene.dataPane : null;
  const isFull = sidebarSize === SidebarSize.Full;

  const controls = scene.controls && (
    <div className={styles.controlsWrapper}>
      <scene.controls.Component model={scene.controls} />
    </div>
  );

  // No data pane (e.g. text panels): render the viz on its own.
  if (!nextDataPane) {
    return (
      <div className={styles.pageContainer}>
        {controls}
        <div className={cx(styles.vizPane, { [styles.fixedSizeViz]: isScrollingLayout })}>
          <div className={styles.vizContent}>
            <PanelEditPanelWrapper panel={scene.panel} tableView={scene.tableView} dashboard={scene.dashboard} />
          </div>
        </div>
      </div>
    );
  }

  const viz = (
    <div
      {...vizDataSplitter.primaryProps}
      className={cx(vizDataSplitter.primaryProps.className, styles.vizPane, {
        [styles.fixedSizeViz]: isScrollingLayout,
      })}
    >
      <div className={styles.vizContent}>
        <PanelEditPanelWrapper panel={scene.panel} tableView={scene.tableView} dashboard={scene.dashboard} />
      </div>
    </div>
  );

  const dataPane = (
    <div className={styles.dataPaneContent}>
      <nextDataPane.Component model={nextDataPane} />
    </div>
  );

  // Sits between the viz and the lower panel in both layouts.
  const banner = showBanner ? (
    <QueryEditorBanner
      useQueryExperienceNext={model.state.useQueryExperienceNext ?? false}
      onToggle={model.onToggleQueryEditorVersion}
      onDismiss={dismissBanner}
      className={styles.banner}
    />
  ) : null;

  const sidebarPane = (
    <div {...sidebarSplitter.primaryProps} className={cx(sidebarSplitter.primaryProps.className, styles.sidebar)}>
      {sidebarSplitter.splitterState.collapsed ? (
        <ExpandButton
          className={styles.expandSidebar}
          onClick={sidebarSplitter.onToggleCollapse}
          label={t('dashboard-scene.viz-and-data-pane.open-sidebar', 'Open sidebar')}
        />
      ) : (
        <div className={styles.sidebarContent}>
          <Sidebar sidebarSize={sidebarSize} setSidebarSize={setSidebarSize} />
        </div>
      )}
    </div>
  );

  // Mini: viz on top; sidebar + data pane nested in the collapsible bottom pane.
  const miniLayout = (
    <>
      {controls}
      <VizDataSplit
        splitter={vizDataSplitter}
        viz={viz}
        banner={banner}
        secondaryClassName={styles.bottom}
        expandClassName={styles.expandQueryPaneMini}
      >
        <div {...sidebarSplitter.containerProps}>
          {sidebarPane}
          <div {...sidebarSplitter.splitterProps} />
          <div
            {...sidebarSplitter.secondaryProps}
            className={cx(sidebarSplitter.secondaryProps.className, styles.dataPane)}
          >
            {dataPane}
          </div>
        </div>
      </VizDataSplit>
    </>
  );

  // Full: full-height sidebar on the left; controls over the viz/data split on the right.
  const fullLayout = (
    <div {...sidebarSplitter.containerProps}>
      {sidebarPane}
      <div {...sidebarSplitter.splitterProps} />
      <div
        {...sidebarSplitter.secondaryProps}
        className={cx(sidebarSplitter.secondaryProps.className, styles.rightStack)}
      >
        {controls}
        <VizDataSplit
          splitter={vizDataSplitter}
          viz={viz}
          banner={banner}
          secondaryClassName={styles.dataPane}
          expandClassName={styles.expandQueryPane}
        >
          {dataPane}
        </VizDataSplit>
      </div>
    </div>
  );

  return (
    <div className={styles.pageContainer}>
      <QueryEditorContextWrapper
        dataPane={nextDataPane}
        onSwitchToClassic={model.onToggleQueryEditorVersion}
        showVersionBanner={showBanner}
      >
        {isFull ? fullLayout : miniLayout}
      </QueryEditorContextWrapper>
    </div>
  );
}

type SnappingSplitter = ReturnType<typeof useVizAndDataPaneLayout>['vizDataSplitter'];

interface VizDataSplitProps {
  splitter: SnappingSplitter;
  viz: ReactNode;
  banner: ReactNode;
  /** Rendered below the banner when the bottom pane is open. */
  children: ReactNode;
  /** Class for the bottom (secondary) pane. */
  secondaryClassName: string;
  /** Class for the collapsed-state expand bar. */
  expandClassName: string;
}

// Vertical viz/data split shared by both layouts. Only the bottom pane's contents and class names
// differ between Mini and Full, so they're passed in.
function VizDataSplit({ splitter, viz, banner, children, secondaryClassName, expandClassName }: VizDataSplitProps) {
  return (
    <div {...splitter.containerProps}>
      {viz}
      <div {...splitter.splitterProps} />
      <div {...splitter.secondaryProps} className={cx(splitter.secondaryProps.className, secondaryClassName)}>
        {splitter.splitterState.collapsed ? (
          <ExpandQueryPane onClick={splitter.onToggleCollapse} className={expandClassName} />
        ) : (
          <>
            {banner}
            {children}
          </>
        )}
      </div>
    </div>
  );
}

// Sidebar expand affordance — mirrors the options pane collapse (canvas ToolbarButton on its edge).
function ExpandButton({ onClick, label, className }: { onClick: () => void; label: string; className: string }) {
  return (
    <div className={className}>
      <ToolbarButton icon="arrow-to-right" variant="canvas" onClick={onClick} tooltip={label} aria-label={label} />
    </div>
  );
}

// Query pane expand affordance — mirrors the v1 collapsed data pane (wider secondary Button bar).
function ExpandQueryPane({ onClick, className }: { onClick: () => void; className: string }) {
  const styles = useStyles2(getExpandQueryPaneButtonStyles);
  const label = t('dashboard-scene.viz-and-data-pane.open-query-pane', 'Open query pane');

  return (
    <div className={className}>
      <Button
        icon="arrow-to-right"
        variant="secondary"
        size="sm"
        onClick={onClick}
        tooltip={label}
        aria-label={label}
        className={styles.button}
      />
    </div>
  );
}

const getExpandQueryPaneButtonStyles = (theme: GrafanaTheme2) => ({
  button: css({
    width: theme.spacing(8),
    justifyContent: 'center',
    // arrow-to-right rotated to point up, matching the v1 collapsed data pane button.
    svg: {
      rotate: '-90deg',
    },
  }),
});

function getStyles(theme: GrafanaTheme2, sidebarSize: SidebarSize) {
  const isMini = sidebarSize === SidebarSize.Mini;

  // Collapsed query pane bar: bottom-anchored, so only the top corners are rounded.
  const expandQueryPaneBar = {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(1),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    flexGrow: 1,
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
  } as const;

  return {
    pageContainer: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      gap: theme.spacing(2),
    }),
    banner: css({
      minWidth: 0,
      overflow: 'hidden',
      ...(isMini && { marginLeft: theme.spacing(2) }),
    }),
    controlsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 0,
      ...(isMini && { paddingLeft: theme.spacing(2) }),
    }),
    vizPane: css({
      position: 'relative',
      minHeight: 0,
      overflow: 'visible',
    }),
    vizContent: css({
      height: '100%',
      width: '100%',
      ...(isMini && { paddingLeft: theme.spacing(2) }),
    }),
    fixedSizeViz: css({
      height: '100vh',
    }),
    rightStack: css({
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      minHeight: 0,
      gap: theme.spacing(2),
    }),
    bottom: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      position: 'relative',
      minHeight: 0,
    }),
    sidebar: css({
      position: 'relative',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      ...(isMini && { paddingLeft: theme.spacing(2) }),
    }),
    sidebarContent: css({
      height: '100%',
      width: '100%',
    }),
    dataPane: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    }),
    dataPaneContent: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    }),
    expandSidebar: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      // Fill the pane so the bordered container tracks the drag, matching the options pane collapse.
      width: '100%',
      padding: theme.spacing(2, 1),
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      // Flush to the bottom in both layouts, and flush left in full-height mode.
      borderBottomLeftRadius: 'unset',
      borderBottomRightRadius: 'unset',
      ...(!isMini && {
        borderTopLeftRadius: 'unset',
      }),
    }),
    expandQueryPane: css(expandQueryPaneBar),
    expandQueryPaneMini: css({
      ...expandQueryPaneBar,
      marginLeft: theme.spacing(2),
    }),
  };
}
