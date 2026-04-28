import { css, cx } from '@emotion/css';
import { useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { type SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui/themes';

import { type PanelEditor } from '../PanelEditor';
import { QueryEditorBanner } from '../QueryEditorBanner';

import { PanelDataPaneNext } from './PanelDataPaneNext';
import { QueryEditorContextWrapper } from './QueryEditor/QueryEditorContextWrapper';
import { Sidebar } from './QueryEditor/Sidebar/Sidebar';
import { SidebarSize } from './constants';
import { useQueryEditorBanner, useVizAndDataPaneLayout } from './hooks';

export function VizAndDataPaneNext({ model }: SceneComponentProps<PanelEditor>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { showBanner, dismissBanner } = useQueryEditorBanner();
  const { scene, layout } = useVizAndDataPaneLayout(model, containerRef, showBanner);
  const styles = useStyles2(getStyles, layout.sidebarSize);

  const nextDataPane = scene.dataPane instanceof PanelDataPaneNext ? scene.dataPane : null;

  return (
    <div ref={containerRef} className={styles.pageContainer} style={layout.gridStyles}>
      {scene.controls && (
        <div className={styles.controlsWrapper}>
          <scene.controls.Component model={scene.controls} />
        </div>
      )}
      <div className={cx(styles.viz, { [styles.fixedSizeViz]: layout.isScrollingLayout })}>
        <scene.panelToShow.Component model={scene.panelToShow} />
        {nextDataPane && (
          <div className={styles.vizResizeHandle}>
            <div
              ref={layout.vizResizeHandle.ref}
              className={layout.vizResizeHandle.className}
              data-testid="viz-resizer"
            />
          </div>
        )}
      </div>
      {nextDataPane && (
        <QueryEditorContextWrapper
          dataPane={nextDataPane}
          onSwitchToClassic={model.onToggleQueryEditorVersion}
          showVersionBanner={showBanner}
        >
          {showBanner && (
            <QueryEditorBanner
              useQueryExperienceNext={model.state.useQueryExperienceNext ?? false}
              onToggle={model.onToggleQueryEditorVersion}
              onDismiss={dismissBanner}
              className={styles.versionToggle}
            />
          )}
          <div className={styles.sidebar}>
            <div className={styles.sidebarContent}>
              <Sidebar sidebarSize={layout.sidebarSize} setSidebarSize={layout.setSidebarSize} />
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
            <nextDataPane.Component model={nextDataPane} />
          </div>
        </QueryEditorContextWrapper>
      )}
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
    versionToggle: css({
      gridArea: 'version-toggle',
      minWidth: 0,
      overflow: 'hidden',
      ...(sidebarSize === SidebarSize.Mini && {
        marginLeft: theme.spacing(2),
      }),
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
    fixedSizeViz: css({
      height: '100vh',
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
