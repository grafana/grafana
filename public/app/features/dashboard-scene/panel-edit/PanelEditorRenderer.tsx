import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Splitter, useStyles2 } from '@grafana/ui';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { PanelEditor } from './PanelEditor';

export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane, vizManager, dataPane, optionsPaneSize } = model.useState();
  const { controls } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const [vizPaneStyles, optionsPaneStyles] = useMemo(() => {
    if (optionsPaneSize > 0) {
      return [{ flexGrow: 1 - optionsPaneSize }, { minWidth: 'unset', overflow: 'hidden', flexGrow: optionsPaneSize }];
    } else {
      return [{ flexGrow: 1 }, { minWidth: 'unset', flexGrow: 0 }];
    }
  }, [optionsPaneSize]);

  return (
    <>
      <NavToolbarActions dashboard={dashboard} />
      <Splitter
        direction="row"
        dragPosition="end"
        initialSize={0.75}
        primaryPaneStyles={vizPaneStyles}
        secondaryPaneStyles={optionsPaneStyles}
        onResizing={model.onOptionsPaneResizing}
        onSizeChanged={model.onOptionsPaneSizeChanged}
      >
        <div className={styles.body}>
          <div className={styles.canvasContent}>
            {controls && (
              <div className={styles.controls}>
                {controls.map((control) => (
                  <control.Component key={control.state.key} model={control} />
                ))}
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
