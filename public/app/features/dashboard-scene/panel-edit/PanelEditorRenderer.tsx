import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { Page } from 'app/core/components/Page/Page';

import { PanelEditor } from './PanelEditor';

export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const { panel, controls, drawer } = model.useState();
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const pageNav = model.getPageNav(location);

  return (
    <Page navId="scenes" pageNav={pageNav} layout={PageLayoutType.Custom}>
      <AppChromeUpdate actions={getToolbarActions(model)} />;
      <div className={styles.canvasContent}>
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </div>
        )}
        <div className={styles.body}>
          <panel.Component model={panel} />
        </div>
      </div>
      {drawer && <drawer.Component model={drawer} />}
    </Page>
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
      padding: theme.spacing(0, 2),
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
