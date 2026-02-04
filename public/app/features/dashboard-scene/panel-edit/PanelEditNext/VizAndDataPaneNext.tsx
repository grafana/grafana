import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

import { PanelEditor } from '../PanelEditor';
import { PreviewOverlay } from '../PreviewOverlay';
import { scrollReflowMediaCondition } from '../useScrollReflowLimit';

import { PanelDataPaneNext } from './PanelDataPaneNext';
import { QueryEditorContextWrapper } from './QueryEditor/QueryEditorContextWrapper';
import { QueryEditorSidebar } from './QueryEditor/Sidebar/QueryEditorSidebar';
import { SidebarSize } from './constants';
import { useVizAndDataPaneLayout } from './hooks';

export function VizAndDataPaneNext({
  model,
  containerHeight = 800,
}: SceneComponentProps<PanelEditor> & { containerHeight?: number }) {
  const { scene, layout, actions, grid } = useVizAndDataPaneLayout(model, containerHeight);
  const styles = useStyles2(getStyles, layout.sidebarSize);
  const { editPreview, optionsPane } = model.useState();

  const [applyPreview, setApplyPreview] = useState<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!optionsPane) {
      setApplyPreview(undefined);
      return;
    }

    setApplyPreview(() => optionsPane.state.applyPreview);

    const sub = optionsPane.subscribeToState((newState) => {
      setApplyPreview(() => newState.applyPreview);
    });

    return () => sub.unsubscribe();
  }, [optionsPane]);

  if (!scene.dataPane || !(scene.dataPane instanceof PanelDataPaneNext)) {
    return null;
  }

  const nextDataPane = scene.dataPane;
  const isPreview = !!editPreview;

  const vizSizeClass = css({
    height: layout.vizResize.height,
    maxHeight: containerHeight - 80,
  });
  const sidebarSizeClass = css({
    height: layout.sidebarSize === SidebarSize.Mini ? layout.bottomPaneHeight : layout.expandedSidebarHeight,
    width: layout.sidebarResize.width,
  });
  const dataPaneSizeClass = css({
    height: layout.bottomPaneHeight,
  });

  return (
    <div className={styles.pageContainer} style={grid.gridStyles}>
      {scene.controls && (
        <div className={styles.controlsWrapper}>
          <scene.controls.Component model={scene.controls} />
        </div>
      )}
      <div className={cx(styles.viz, { [styles.fixedSizeViz]: layout.isScrollingLayout }, vizSizeClass)}>
        <div className={cx(styles.vizInner, isPreview && styles.previewBorder)}>
          {isPreview && <PreviewOverlay onApply={applyPreview} />}
          <scene.panelToShow.Component model={scene.panelToShow} />
        </div>
        <div className={styles.vizResizerWrapper}>
          <div ref={layout.vizResize.handleRef} className={layout.vizResize.className} data-testid="viz-resizer" />
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
      overflow: 'visible',
      position: 'relative',
      boxSizing: 'border-box',
      paddingBottom: theme.spacing(2),
      paddingLeft: theme.spacing(2),
    }),
    viz: css({
      gridArea: 'viz',
      overflow: 'visible',
      height: '100%',
      minHeight: 100,
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
    fullSizeEditor: css({
      height: 'max-content',
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
    vizInner: css({
      height: '100%',
      width: '100%',
    }),
    previewBorder: css({
      border: `2px solid ${theme.colors.primary.border}`,
      borderRadius: theme.shape.radius.default,
      position: 'relative',
    }),
  };
}
