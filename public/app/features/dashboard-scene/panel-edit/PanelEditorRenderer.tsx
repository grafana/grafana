import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Splitter, ToolbarButton, useSnappingSplitter, useStyles2 } from '@grafana/ui';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { PanelEditor } from './PanelEditor';

export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane, vizManager, dataPane } = model.useState();
  const { controls } = dashboard.useState();
  const styles = useStyles2(getStyles);

  const {
    containerProps: outerContainer,
    firstPaneProps: outerLeftPaneProps,
    secondPaneProps: optionsPaneProps,
    splitterProps: optionsSplitterProps,
    state: outerSplitterState,
  } = useSnappingSplitter({
    direction: 'row',
    dragPosition: 'end',
    initialSize: 0.75,
    paneOptions: {
      collapseBelowPixels: 300,
      snapOpenToPixels: 400,
    },
  });

  return (
    <>
      <NavToolbarActions dashboard={dashboard} />
      <div {...outerContainer}>
        <div {...outerLeftPaneProps} className={cx(outerLeftPaneProps.className, styles.body)}>
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
        <div {...optionsSplitterProps} />
        <div {...optionsPaneProps} className={cx(optionsPaneProps.className, styles.optionsPane)}>
          {outerSplitterState.collapsed && (
            <div className={styles.expandButtonWrapper}>
              <ToolbarButton
                tooltip={'Open options pane'}
                icon={'arrow-to-right'}
                onClick={() => {}}
                variant="canvas"
                className={styles.rotateIcon}
                aria-label={'Open options pane'}
              />
            </div>
          )}
          {!outerSplitterState.collapsed && <optionsPane.Component model={optionsPane} />}
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
      padding: theme.spacing(2, 0, 2, 2),
    }),
    optionsPane: css({
      flexDirection: 'column',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
    expandButtonWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 1),
    }),
    rotateIcon: css({
      rotate: '180deg',
    }),
  };
}
