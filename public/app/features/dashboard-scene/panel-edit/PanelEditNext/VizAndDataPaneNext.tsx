import { css, cx } from '@emotion/css';
import { useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

import { PanelEditor } from '../PanelEditor';

import { PanelDataPaneNext } from './PanelDataPaneNext';
import { QueryEditorContextWrapper } from './QueryEditor/QueryEditorContextWrapper';
import { QueryEditorSidebar } from './QueryEditor/Sidebar/QueryEditorSidebar';
import { SidebarSize } from './constants';
import { useVizAndDataPaneLayout } from './hooks';

export function VizAndDataPaneNext({ model }: SceneComponentProps<PanelEditor>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scene, layout, actions } = useVizAndDataPaneLayout(model, containerRef);
  const styles = useStyles2(getStyles, layout.sidebarSize);

  if (!scene.dataPane || !(scene.dataPane instanceof PanelDataPaneNext)) {
    return null;
  }

  const nextDataPane = scene.dataPane;

  return (
    <div ref={containerRef} className={styles.pageContainer} style={layout.gridStyles}>
      {scene.controls && (
        <div className={styles.controlsWrapper}>
          <scene.controls.Component model={scene.controls} />
        </div>
      )}
      <div className={cx(styles.viz, { [styles.fixedSizeViz]: layout.isScrollingLayout })}>
        <scene.panelToShow.Component model={scene.panelToShow} />
        <div className={styles.vizResizeHandle}>
          <div
            ref={layout.vizResizeHandle.ref}
            className={layout.vizResizeHandle.className}
            data-testid="viz-resizer"
          />
        </div>
      </div>
      <QueryEditorContextWrapper dataPane={nextDataPane}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarContent}>
            <QueryEditorSidebar sidebarSize={layout.sidebarSize} setSidebarSize={layout.setSidebarSize} />
          </div>
          <div className={styles.sidebarResizeHandle}>
            <div
              ref={layout.sidebarResizeHandle.ref}
              className={cx(layout.sidebarResizeHandle.className, styles.resizeHandlePill)}
              data-testid="sidebar-resizer"
            />
          </div>
        </div>
        <div className={styles.dataPane}>
          {layout.isDataPaneCollapsed ? (
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
  return {
    pageContainer: css({
      display: 'grid',
      gap: theme.spacing(2),
      overflow: 'hidden',
      paddingBottom: theme.spacing(2),
    }),
    sidebar: css({
      gridArea: 'sidebar',
      position: 'relative',
      paddingLeft: theme.spacing(2),
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    }),
    sidebarContent: css({
      height: '100%',
    }),
    viz: css({
      gridArea: 'viz',
      overflow: 'visible',
      position: 'relative',
      minHeight: 0,
      ...(sidebarSize === SidebarSize.Mini && {
        paddingLeft: theme.spacing(2),
      }),
    }),
    dataPane: css({
      gridArea: 'data-pane',
      overflow: 'hidden',
      minHeight: 0,
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
      padding: theme.spacing(1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      justifyContent: 'space-around',
    }),
    vizResizeHandle: css({
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    }),
    sidebarResizeHandle: css({
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
    }),
    resizeHandlePill: css({
      height: '100%',
      width: 2,
    }),
  };
}
