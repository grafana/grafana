import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

import { PanelEditor } from '../PanelEditor';
import { scrollReflowMediaCondition } from '../useScrollReflowLimit';

import { PanelDataPaneNext } from './PanelDataPaneNext';
import { QueryEditorContextWrapper } from './QueryEditor/QueryEditorContextWrapper';
import { QueryEditorSidebar } from './QueryEditor/Sidebar/QueryEditorSidebar';
import { SidebarSize } from './constants';
import { useVizAndDataPaneLayout } from './hooks';

export function VizAndDataPaneNext({
  model,
  containerHeight = 800,
  containerWidth = 800,
}: SceneComponentProps<PanelEditor> & { containerHeight?: number; containerWidth?: number }) {
  const { scene, layout, actions, grid } = useVizAndDataPaneLayout(model, containerHeight, containerWidth);
  const styles = useStyles2(getStyles, layout.sidebarSize);

  if (!scene.dataPane || !(scene.dataPane instanceof PanelDataPaneNext)) {
    return null;
  }

  const nextDataPane = scene.dataPane;

  const sidebarSizeClass = css({
    height: layout.sidebarSize === SidebarSize.Mini ? '100%' : layout.expandedSidebarHeight,
  });
  const dataPaneSizeClass = css({
    height: '100%',
  });

  return (
    <div className={styles.pageContainer} style={grid.gridStyles}>
      {scene.controls && (
        <div className={styles.controlsWrapper}>
          <scene.controls.Component model={scene.controls} />
        </div>
      )}
      <div className={cx(styles.viz, { [styles.fixedSizeViz]: layout.isScrollingLayout })}>
        <scene.panelToShow.Component model={scene.panelToShow} />
        <div className={styles.vizResizerWrapper}>
          <div
            ref={layout.vizResizeHandle.ref}
            className={layout.vizResizeHandle.className}
            data-testid="viz-resizer"
          />
        </div>
      </div>
      <QueryEditorContextWrapper dataPane={nextDataPane}>
        <div className={cx(styles.sidebar, sidebarSizeClass)}>
          <QueryEditorSidebar sidebarSize={layout.sidebarSize} setSidebarSize={layout.setSidebarSize} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, height: '100%' }}>
            <div
              style={{ height: '100%', width: 2 }}
              ref={layout.sidebarResize.handleRef}
              className={layout.sidebarResize.className}
              data-testid="sidebar-resizer"
            />
          </div>
        </div>
        <div className={cx(styles.dataPane, dataPaneSizeClass)}>
          {grid.splitterState.collapsed ? (
            <div className={styles.expandDataPane}>
              <Button
                tooltip={t('dashboard-scene.viz-and-data-pane.tooltip-open-query-pane', 'Open query pane')}
                icon={'arrow-to-right'}
                onClick={actions.onToggleCollapse}
                variant="secondary"
                size="sm"
                className={styles.openDataPaneButton}
                aria-label={t('dashboard-scene.viz-and-data-pane.aria-label-open-query-pane', 'Open query pane')}
              />
            </div>
          ) : (
            <nextDataPane.Component model={nextDataPane} />
          )}
        </div>
      </QueryEditorContextWrapper>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2, sidebarSize: SidebarSize) {
  const scrollReflowMediaQuery = '@media ' + scrollReflowMediaCondition;
  return {
    pageContainer: css({
      display: 'grid',
      gap: theme.spacing(2),
      gridTemplateColumns: `auto 1fr`,
      overflow: 'hidden',
      [scrollReflowMediaQuery]: {
        gridTemplateColumns: `100%`,
      },
    }),
    sidebar: css({
      gridArea: 'sidebar',
      overflow: 'hidden',
      position: 'relative',
      boxSizing: 'border-box',
      paddingBottom: theme.spacing(2),
      paddingLeft: theme.spacing(2),
    }),
    viz: css({
      gridArea: 'viz',
      overflow: 'visible',
      height: '100%',
      position: 'relative',
      ...(sidebarSize === SidebarSize.Mini && {
        paddingLeft: theme.spacing(2),
      }),
    }),
    dataPane: css({
      gridArea: 'data-pane',
      overflow: 'hidden',
      boxSizing: 'border-box',
      paddingBottom: theme.spacing(2),
    }),
    controlsWrapper: css({
      gridArea: 'controls',
      display: 'flex',
      flexDirection: 'column',
      ...(sidebarSize === SidebarSize.Mini && {
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
    vizResizerWrapper: css({
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
    }),
  };
}
