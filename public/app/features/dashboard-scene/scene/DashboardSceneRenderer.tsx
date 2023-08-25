import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from './DashboardScene';
import { NavToolbarActions } from './NavToolbarActions';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { controls, viewPanelKey, drawer } = model.useState();
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const pageNav = model.getPageNav(location);
  const bodyToRender = model.getBodyToRender(viewPanelKey);

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
          <div className={styles.body}>
            <bodyToRender.Component model={bodyToRender} />
          </div>
        </div>
      </CustomScrollbar>
      {drawer && <drawer.Component model={drawer} />}
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
