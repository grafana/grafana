import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';

import { getDashboardSceneFor } from '../utils/utils';

import { PanelEditor } from './PanelEditor';

export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { body } = model.useState();
  const { controls } = dashboard.useState();
  const styles = useStyles2(getStyles);

  return (
    <>
      <AppChromeUpdate actions={getToolbarActions(model)} />
      <div className={styles.canvasContent}>
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
    </>
  );
}

function getToolbarActions(editor: PanelEditor) {
  return (
    <>
      <NavToolbarSeparator leftActionsSeparator key="separator" />

      <Button
        onClick={editor.onDiscard}
        tooltip=""
        key="panel-edit-discard"
        variant="destructive"
        fill="outline"
        size="sm"
      >
        Discard
      </Button>

      <Button onClick={editor.onApply} tooltip="" key="panel-edit-apply" variant="primary" size="sm">
        Apply
      </Button>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    canvasContent: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      flexBasis: '100%',
      flexGrow: 1,
      minHeight: 0,
      width: '100%',
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      position: 'relative',
      minHeight: 0,
      gap: '8px',
      marginBottom: theme.spacing(2),
    }),
    controls: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(2, 0),
    }),
  };
}
