import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, CustomScrollbar, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { Page } from 'app/core/components/Page/Page';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

import { DashboardScene } from './DashboardScene';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { title, body, actions = [], controls, isEditing, isDirty, uid } = model.useState();
  const styles = useStyles2(getStyles);
  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  if (uid) {
    toolbarActions.push(
      <DashNavButton
        key="button-scenes"
        tooltip={'View as dashboard'}
        icon="apps"
        onClick={() => locationService.push(`/d/${uid}`)}
      />
    );
  }

  toolbarActions.push(<NavToolbarSeparator leftActionsSeparator />);

  if (!isEditing) {
    // TODO check permissions
    toolbarActions.push(
      <Button
        onClick={model.onEnterEditMode}
        tooltip="Enter edit mode"
        key="edit"
        variant="primary"
        icon="pen"
        fill="text"
      >
        Edit
      </Button>
    );
  } else {
    // TODO check permissions
    toolbarActions.push(
      <Button onClick={model.onEnterEditMode} tooltip="Save as copy" fill="text" key="save-as">
        Save as
      </Button>
    );
    toolbarActions.push(
      <Button onClick={model.onDiscard} tooltip="Save changes" fill="text" key="discard" variant="destructive">
        Discard
      </Button>
    );
    toolbarActions.push(
      <Button onClick={model.onEnterEditMode} tooltip="Save changes" key="save" disabled={!isDirty}>
        Save
      </Button>
    );
  }

  return (
    <Page navId="scenes" pageNav={{ text: title }} layout={PageLayoutType.Custom}>
      <CustomScrollbar autoHeightMin={'100%'}>
        <div className={styles.canvasContent}>
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
        </div>
      </CustomScrollbar>
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
      flexGrow: 1,
      display: 'flex',
      gap: '8px',
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
