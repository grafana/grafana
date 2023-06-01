import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneObjectBase, SceneComponentProps, SceneObject, SceneObjectState } from '@grafana/scenes';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';

interface DashboardSceneState extends SceneObjectState {
  title: string;
  uid?: string;
  body: SceneObject;
  actions?: SceneObject[];
  controls?: SceneObject[];
}

export class DashboardScene extends SceneObjectBase<DashboardSceneState> {
  public static Component = DashboardSceneRenderer;
}

function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { title, body, actions = [], uid, controls } = model.useState();
  const styles = useStyles2(getStyles);

  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  if (uid?.length) {
    toolbarActions.push(
      <ToolbarButton
        icon="apps"
        onClick={() => locationService.push(`/d/${uid}`)}
        tooltip="View as Dashboard"
        key="scene-to-dashboard-switch"
      />
    );
  }

  return (
    <Page navId="scenes" pageNav={{ text: title }} layout={PageLayoutType.Canvas}>
      <AppChromeUpdate actions={toolbarActions} />
      {controls && (
        <div className={styles.controls}>
          {controls.map((control) => (
            <control.Component key={control.state.key} model={control} />
          ))}
        </div>
      )}
      <div className={styles.body}>
        <body.Component model={body} />
      </div>
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    body: css({
      flexGrow: 1,
      display: 'flex',
      gap: '8px',
    }),
    controls: css({
      display: 'flex',
      paddingBottom: theme.spacing(2),
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
  };
}
