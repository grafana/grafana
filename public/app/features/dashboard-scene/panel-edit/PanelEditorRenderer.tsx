import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, ToolbarButton, useStyles2 } from '@grafana/ui';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { UnlinkModal } from '../scene/UnlinkModal';
import { getDashboardSceneFor, getLibraryPanel } from '../utils/utils';

import { PanelEditor } from './PanelEditor';
import { SaveLibraryVizPanelModal } from './SaveLibraryVizPanelModal';
import { useSnappingSplitter } from './splitter/useSnappingSplitter';

export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane } = model.useState();
  const styles = useStyles2(getStyles);

  const { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } =
    useSnappingSplitter({
      direction: 'row',
      dragPosition: 'end',
      initialSize: 0.75,
      paneOptions: {
        collapseBelowPixels: 250,
        snapOpenToPixels: 400,
      },
    });

  return (
    <>
      <NavToolbarActions dashboard={dashboard} />
      <div {...containerProps}>
        <div {...primaryProps} className={cx(primaryProps.className, styles.body)}>
          <VizAndDataPane model={model} />
        </div>
        <div {...splitterProps} />
        <div {...secondaryProps} className={cx(secondaryProps.className, styles.optionsPane)}>
          {splitterState.collapsed && (
            <div className={styles.expandOptionsWrapper}>
              <ToolbarButton
                tooltip={'Open options pane'}
                icon={'arrow-to-right'}
                onClick={onToggleCollapse}
                variant="canvas"
                className={styles.rotate180}
                aria-label={'Open options pane'}
              />
            </div>
          )}
          {!splitterState.collapsed && <optionsPane.Component model={optionsPane} />}
        </div>
      </div>
    </>
  );
}

function VizAndDataPane({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { vizManager, dataPane, showLibraryPanelSaveModal, showLibraryPanelUnlinkModal } = model.useState();
  const { sourcePanel } = vizManager.useState();
  const libraryPanel = getLibraryPanel(sourcePanel.resolve());
  const { controls } = dashboard.useState();
  const styles = useStyles2(getStyles);

  const { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } =
    useSnappingSplitter({
      direction: 'column',
      dragPosition: 'start',
      initialSize: 0.5,
      paneOptions: {
        collapseBelowPixels: 150,
      },
    });

  if (!dataPane) {
    primaryProps.style.flexGrow = 1;
  }

  return (
    <>
      <div className={styles.controlsWrapper}>{controls && <controls.Component model={controls} />}</div>
      <div {...containerProps}>
        <div {...primaryProps}>
          <vizManager.Component model={vizManager} />
        </div>
        {showLibraryPanelSaveModal && libraryPanel && (
          <SaveLibraryVizPanelModal
            libraryPanel={libraryPanel}
            onDismiss={model.onDismissLibraryPanelSaveModal}
            onConfirm={model.onConfirmSaveLibraryPanel}
            onDiscard={model.onDiscard}
          ></SaveLibraryVizPanelModal>
        )}
        {showLibraryPanelUnlinkModal && libraryPanel && (
          <UnlinkModal
            onDismiss={model.onDismissUnlinkLibraryPanelModal}
            onConfirm={model.onConfirmUnlinkLibraryPanel}
            isOpen
          />
        )}
        {dataPane && (
          <>
            <div {...splitterProps} />
            <div {...secondaryProps}>
              {splitterState.collapsed && (
                <div className={styles.expandDataPane}>
                  <Button
                    tooltip={'Open query pane'}
                    icon={'arrow-to-right'}
                    onClick={onToggleCollapse}
                    variant="secondary"
                    size="sm"
                    className={styles.openDataPaneButton}
                    aria-label={'Open query pane'}
                  />
                </div>
              )}
              {!splitterState.collapsed && <dataPane.Component model={dataPane} />}
            </div>
          </>
        )}
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
      flexDirection: 'column',
      minHeight: 0,
    }),
    optionsPane: css({
      flexDirection: 'column',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
    expandOptionsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 1),
    }),
    expandDataPane: css({
      display: 'flex',
      flexDirection: 'row',
      padding: theme.spacing(1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      flexGrow: 1,
      justifyContent: 'space-around',
    }),
    rotate180: css({
      rotate: '180deg',
    }),
    controlsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 0,
      paddingLeft: theme.spacing(2),
    }),
    openDataPaneButton: css({
      width: theme.spacing(8),
      justifyContent: 'center',
      svg: {
        rotate: '-90deg',
      },
    }),
  };
}
