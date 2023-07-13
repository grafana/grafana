import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from './DashboardScene';
import { NavToolbarActions } from './NavToolbarActions';
import { ScenePanelInspector } from './ScenePanelInspector';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { body, controls, inspectPanelKey, viewPanelKey } = model.useState();
  const styles = useStyles2(getStyles);
  const inspectPanel = model.findPanel(inspectPanelKey);
  const viewPanel = model.findPanel(viewPanelKey);
  const location = useLocation();
  const pageNav = model.getPageNav(location);

  return (
    <Page navId="scenes" pageNav={pageNav} layout={PageLayoutType.Custom}>
      <CustomScrollbar autoHeightMin={'100%'}>
        <div className={styles.canvasContent}>
          <NavToolbarActions dashboard={model} />
          {controls && (
            <div className={styles.controls}>
              {controls.map((control) => (
                <control.Component key={control.state.key} model={control} />
              ))}
            </div>
          )}
          {viewPanel ? (
            <div className={styles.viewPanel}>
              <viewPanel.Component model={viewPanel} />
            </div>
          ) : (
            <div className={styles.body}>
              <body.Component model={body} />
            </div>
          )}
        </div>
      </CustomScrollbar>
      {inspectPanel && <ScenePanelInspector panel={inspectPanel} dashboard={model} />}
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    canvasContent: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0, 2),
      flexBasis: '100%',
      flexGrow: 1,
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      gap: '8px',
    }),
    viewPanel: css({
      display: 'flex',
      position: 'relative',
      flexGrow: 1,
      marginBottom: theme.spacing(2),
    }),
    controls: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
      position: 'sticky',
      top: 0,
      background: theme.colors.background.canvas,
      zIndex: 1,
      padding: theme.spacing(2, 0),
    }),
  };
}
