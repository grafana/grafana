import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { Spinner, ToolbarButton, useStyles2, useTheme2 } from '@grafana/ui';
import { MIN_SUGGESTIONS_PANE_WIDTH } from 'app/features/panel/suggestions/constants';

import { useEditPaneCollapsed } from '../edit-pane/shared';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { UnlinkModal } from '../scene/UnlinkModal';
import { getDashboardSceneFor, getLibraryPanelBehavior } from '../utils/utils';

import { PanelDataSidebar, SidebarSize, SidebarState } from './PanelDataPane/PanelDataSidebar';
import { PanelEditor } from './PanelEditor';
import { SaveLibraryVizPanelModal } from './SaveLibraryVizPanelModal';
import { useSnappingSplitter } from './splitter/useSnappingSplitter';
import { scrollReflowMediaCondition, useScrollReflowLimit } from './useScrollReflowLimit';

export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane } = model.useState();
  const styles = useStyles2(getWrapperStyles);
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
    <>
      <NavToolbarActions dashboard={dashboard} />
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
    </>
  );
}

function VizAndDataPane({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { dataPane, showLibraryPanelSaveModal, showLibraryPanelUnlinkModal, tableView } = model.useState();
  const panel = model.getPanel();
  const libraryPanel = getLibraryPanelBehavior(panel);
  const { controls } = dashboard.useState();
  const [sidebarState, setSidebarState] = useState<SidebarState>({ size: SidebarSize.Mini, collapsed: false });
  const [containerRef, { height: containerHeight }] = useMeasure<HTMLDivElement>();
  const [vizRef, { height: vizHeight }] = useMeasure<HTMLDivElement>();

  const styles = useStyles2(getStyles, sidebarState);

  const isScrollingLayout = useScrollReflowLimit();

  const gridStyles = useMemo(() => {
    const rows = [];
    const grid = [];

    if (controls) {
      rows.push('auto');
      grid.push(['controls', 'controls']);
    }

    grid.push(['viz', 'viz']);
    rows.push('1fr');

    if (dataPane) {
      // rows.push(`${(containerHeight - vizHeight) + 40}px`);
      rows.push('auto');
      grid.push(['sidebar', 'data-pane']);
      if (sidebarState.size === SidebarSize.Full) {
        for (let i = 0; i < grid.length; i++) {
          grid[i][0] = 'sidebar';
        }
      }
    }

    return {
      gridTemplateAreas: '\n' + grid.map((row) => `"${row.join(' ')}"`).join('\n'),
      // gridTemplateRows: rows.map((r) => r).join(' '),
    };
  }, [controls, dataPane, sidebarState.size]);

  return (
    <div ref={containerRef} className={styles.pageContainer} style={gridStyles}>
      {controls && (
        <div className={styles.controlsWrapper}>
          <controls.Component model={controls} />
        </div>
      )}

      <div ref={vizRef} className={cx(styles.viz, isScrollingLayout && styles.fixedSizeViz)}>
        {tableView ? <tableView.Component model={tableView} /> : <panel.Component model={panel} />}
      </div>

      {dataPane && (
        <>
          <div className={cx(styles.dataPane, isScrollingLayout && styles.fullSizeEditor)}>
            <dataPane.Component model={dataPane} />
          </div>
          <div className={styles.sidebar}>
            <PanelDataSidebar model={dataPane} sidebarState={sidebarState} setSidebarState={setSidebarState} />
          </div>
        </>
      )}
      {showLibraryPanelSaveModal && libraryPanel && (
        <SaveLibraryVizPanelModal
          libraryPanel={libraryPanel}
          onDismiss={model.onDismissLibraryPanelSaveModal}
          onConfirm={model.onConfirmSaveLibraryPanel}
          onDiscard={model.onDiscard}
        ></SaveLibraryVizPanelModal>
      )}
      {showLibraryPanelUnlinkModal && libraryPanel && (
        <UnlinkModal
          onDismiss={model.onDismissUnlinkLibraryPanelModal}
          onConfirm={model.onConfirmUnlinkLibraryPanel}
          isOpen
        />
      )}
    </div>
  );
}

function getWrapperStyles(theme: GrafanaTheme2) {
  const scrollReflowMediaQuery = '@media ' + scrollReflowMediaCondition;
  return {
    content: css({
      position: 'absolute',
      width: '100%',
      height: '100%',
      overflow: 'unset',
      paddingTop: theme.spacing(2),
      [scrollReflowMediaQuery]: {
        height: 'auto',
        display: 'grid',
        gridTemplateColumns: 'minmax(470px, 1fr) 330px',
        gridTemplateRows: '1fr',
        gap: theme.spacing(1),
        position: 'static',
        width: '100%',
      },
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
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
    rotate180: css({
      rotate: '180deg',
    }),
  };
}

function getStyles(theme: GrafanaTheme2, sidebarState: SidebarState) {
  const scrollReflowMediaQuery = '@media ' + scrollReflowMediaCondition;
  return {
    pageContainer: css({
      display: 'grid',
      gap: theme.spacing(2),
      gridTemplateColumns: `auto 1fr`,
      gridTemplateRows: `auto 0.7fr 0.3fr`,
      height: '100%',
      minHeight: '100%',
      maxHeight: '100%',
      overflow: 'hidden',
      [scrollReflowMediaQuery]: {
        gridTemplateColumns: `100%`,
      },
    }),
    sidebar: css({
      gridArea: 'sidebar',
      overflow: 'auto',
      resize: 'horizontal',
      minWidth: 285,
      maxWidth: 400,
      ...(sidebarState.size === SidebarSize.Mini && {
        paddingLeft: theme.spacing(2),
      }),
    }),
    viz: css({
      gridArea: 'viz',
      overflow: 'auto',
      resize: 'vertical',
      minHeight: 200,
      maxHeight: 700, // FIXME: needs a dynamic height
      ...(sidebarState.size === SidebarSize.Mini && {
        paddingLeft: theme.spacing(2),
      }),
    }),
    dataPane: css({
      gridArea: 'data-pane',
    }),
    controlsWrapper: css({
      gridArea: 'controls',
      display: 'flex',
      flexDirection: 'column',
      ...(sidebarState.size === SidebarSize.Mini && {
        paddingLeft: theme.spacing(2),
      }),
    }),
    openDataPaneButton: css({
      width: theme.spacing(8),
      justifyContent: 'center',
      svg: {
        rotate: '-90deg',
      },
    }),
    fixedSizeViz: css({
      height: '100vh',
    }),
    fullSizeEditor: css({
      height: 'max-content',
    }),
  };
}
