import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Splitter, ToolbarButton, useStyles2 } from '@grafana/ui';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { PanelEditor } from './PanelEditor';

export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane, vizManager, dataPane } = model.useState();
  const { controls } = dashboard.useState();
  const styles = useStyles2(getStyles);

  return (
    <>
      <NavToolbarActions dashboard={dashboard} />
      <Splitter
        direction="row"
        dragPosition="end"
        initialSize={0.75}
        primaryPaneStyles={{ paddingRight: !optionsPane ? 16 : 0 }}
      >
        <div className={styles.body}>
          <div className={styles.canvasContent}>
            {controls && (
              <div className={styles.controls}>
                {controls.map((control) => (
                  <control.Component key={control.state.key} model={control} />
                ))}
                {!optionsPane && (
                  <ToolbarButton
                    title="Show options pane"
                    onClick={() => model.toggleOptionsPane()}
                    variant="canvas"
                    icon="cog"
                  >
                    Options
                  </ToolbarButton>
                )}
              </div>
            )}
            <Splitter
              direction="column"
              primaryPaneStyles={{ minHeight: 0, paddingBottom: !dataPane ? 16 : 0 }}
              secondaryPaneStyles={{ minHeight: 0, overflow: 'hidden' }}
              dragPosition="start"
            >
              <vizManager.Component model={vizManager} />
              {dataPane && <dataPane.Component model={dataPane} />}
            </Splitter>
          </div>
        </div>
        {optionsPane && <optionsPane.Component model={optionsPane} />}
      </Splitter>
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
    }),
    controls: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(2, 0, 2, 2),
    }),
  };
}
