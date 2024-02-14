import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Splitter, useStyles2 } from '@grafana/ui';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { PanelEditor } from './PanelEditor';
import { VisualizationButton } from './PanelOptionsPane';

export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane, vizManager, dataPane } = model.useState();
  const { controls } = dashboard.useState();
  const styles = useStyles2(getStyles);

  return (
    <>
      <NavToolbarActions dashboard={dashboard} />
      <div className={styles.canvasContent}>
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
            {!optionsPane && (
              <VisualizationButton
                pluginId={vizManager.state.panel.state.pluginId}
                onOpen={() => model.toggleOptionsPane(true)}
                isOpen={false}
                onTogglePane={() => model.toggleOptionsPane()}
              />
            )}
          </div>
        )}
        <div className={styles.body}>
          <Splitter
            direction="row"
            dragPosition="end"
            initialSize={0.75}
            primaryPaneStyles={{ paddingBottom: !dataPane ? 16 : 0 }}
          >
            <Splitter
              direction="column"
              primaryPaneStyles={{ minHeight: 0, paddingRight: !optionsPane ? 16 : 0 }}
              secondaryPaneStyles={{ minHeight: 0, overflow: 'hidden' }}
              dragPosition="start"
            >
              <vizManager.Component model={vizManager} />
              {dataPane && <dataPane.Component model={dataPane} />}
            </Splitter>
            {optionsPane && <optionsPane.Component model={optionsPane} />}
          </Splitter>
        </div>
      </div>
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
      padding: theme.spacing(2),
    }),
  };
}
