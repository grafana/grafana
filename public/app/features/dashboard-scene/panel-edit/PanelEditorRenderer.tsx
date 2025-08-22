import { css, cx } from '@emotion/css';
import { useEffect } from 'react';
import { useMedia } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { SceneComponentProps, VizPanel } from '@grafana/scenes';
import { Button, Spinner, ToolbarButton, useStyles2 } from '@grafana/ui';

import { useEditPaneCollapsed } from '../edit-pane/shared';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { UnlinkModal } from '../scene/UnlinkModal';
import { getDashboardSceneFor, getLibraryPanelBehavior } from '../utils/utils';

import { PanelEditor } from './PanelEditor';
import { SaveLibraryVizPanelModal } from './SaveLibraryVizPanelModal';
import { useSnappingSplitter } from './splitter/useSnappingSplitter';

const MEDIA_QUERY = '(max-height: 500px), (max-width: 768.05px)';

export function PanelEditorRenderer({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane } = model.useState();
  const styles = useStyles2(getStyles);
  const [isCollapsed, setIsCollapsed] = useEditPaneCollapsed();

  const { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } =
    useSnappingSplitter({
      direction: 'row',
      dragPosition: 'end',
      initialSize: 330,
      usePixels: true,
      collapsed: isCollapsed,
      collapseBelowPixels: 250,
    });

  useEffect(() => {
    setIsCollapsed(splitterState.collapsed);
  }, [splitterState.collapsed, setIsCollapsed]);

  const noScroll = useMedia(MEDIA_QUERY);

  if (noScroll) {
    containerProps.className = '';

    secondaryProps.style.overflowY = 'visible';
    secondaryProps.style.minHeight = 'max-content';
    secondaryProps.className = '';

    splitterProps.style.display = 'none';

    primaryProps.className = '';
    primaryProps.style = {};
  }

  return (
    <>
      <NavToolbarActions dashboard={dashboard} />
      <div
        {...containerProps}
        className={cx(containerProps.className, styles.content)}
        data-testid={selectors.components.PanelEditor.General.content}
      >
        <div {...primaryProps} className={cx(primaryProps.className, styles.body)}>
          <VizAndDataPane model={model} />
        </div>
        <div {...splitterProps} />
        <div {...secondaryProps} className={cx(secondaryProps.className, styles.optionsPane)}>
          {splitterState.collapsed && (
            <div className={styles.expandOptionsWrapper}>
              <ToolbarButton
                tooltip={t('dashboard-scene.panel-editor-renderer.tooltip-open-options-pane', 'Open options pane')}
                icon={'arrow-to-right'}
                onClick={onToggleCollapse}
                variant="canvas"
                className={styles.rotate180}
                aria-label={t(
                  'dashboard-scene.panel-editor-renderer.aria-label-open-options-pane',
                  'Open options pane'
                )}
              />
            </div>
          )}
          {!splitterState.collapsed && optionsPane && <optionsPane.Component model={optionsPane} />}
          {!splitterState.collapsed && !optionsPane && <Spinner />}
        </div>
      </div>
    </>
  );
}

function VizAndDataPane({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { dataPane, showLibraryPanelSaveModal, showLibraryPanelUnlinkModal, tableView } = model.useState();
  const panel = model.getPanel();
  const libraryPanel = getLibraryPanelBehavior(panel);
  const { controls } = dashboard.useState();
  const styles = useStyles2(getStyles);

  let { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } =
    useSnappingSplitter({
      direction: 'column',
      dragPosition: 'start',
      initialSize: 0.5,
      collapseBelowPixels: 150,
    });

  containerProps.className = cx(containerProps.className, styles.container);

  if (!dataPane) {
    primaryProps.style.flexGrow = 1;
  }

  const noScroll = useMedia(MEDIA_QUERY);

  const collapsed = noScroll ? false : splitterState.collapsed;

  if (noScroll) {
    containerProps.className = styles.container;
    primaryProps.className = styles.fixedSizePanel;
    secondaryProps.className = styles.fixedSizePanel;
    splitterProps.style.display = 'none';
  }

  return (
    <div className={cx(styles.pageContainer, controls && styles.pageContainerWithControls)}>
      {controls && (
        <div className={styles.controlsWrapper}>
          <controls.Component model={controls} />
        </div>
      )}
      <div {...containerProps}>
        <div {...primaryProps}>
          <VizWrapper panel={panel} tableView={tableView} />
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
              {collapsed && (
                <div className={styles.expandDataPane}>
                  <Button
                    tooltip={t('dashboard-scene.viz-and-data-pane.tooltip-open-query-pane', 'Open query pane')}
                    icon={'arrow-to-right'}
                    onClick={onToggleCollapse}
                    variant="secondary"
                    size="sm"
                    className={styles.openDataPaneButton}
                    aria-label={t('dashboard-scene.viz-and-data-pane.aria-label-open-query-pane', 'Open query pane')}
                  />
                </div>
              )}
              {!collapsed && <dataPane.Component model={dataPane} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface VizWrapperProps {
  panel: VizPanel;
  tableView?: VizPanel;
}

function VizWrapper({ panel, tableView }: VizWrapperProps) {
  const styles = useStyles2(getStyles);
  const panelToShow = tableView ?? panel;

  return (
    <div className={styles.vizWrapper}>
      <panelToShow.Component model={panelToShow} />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    pageContainer: css({
      display: 'grid',
      gridTemplateAreas: `
        "panels"`,
      gridTemplateColumns: `1fr`,
      gridTemplateRows: '1fr',
      height: '100%',
      ['@media ' + MEDIA_QUERY]: {
        gridTemplateColumns: `100%`,
      },
    }),
    pageContainerWithControls: css({
      gridTemplateAreas: `
        "controls"
        "panels"`,
      gridTemplateRows: 'auto 1fr',
    }),
    container: css({
      gridArea: 'panels',
      height: '100%',
    }),
    canvasContent: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      flexBasis: '100%',
      flexGrow: 1,
      minHeight: 0,
      width: '100%',
    }),
    content: css({
      position: 'absolute',
      width: '100%',
      height: '100%',
      overflow: 'unset',
      ['@media ' + MEDIA_QUERY]: {
        height: 'auto',
        display: 'grid',
        gridTemplateColumns: 'minmax(470px, 1fr) 330px',
        gridTemplateRows: '1fr',
        gap: theme.spacing(1),
        width: '100%',
      },
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
      marginTop: theme.spacing(2),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderTopLeftRadius: theme.shape.radius.default,
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
      gridArea: 'controls',
    }),
    openDataPaneButton: css({
      width: theme.spacing(8),
      justifyContent: 'center',
      svg: {
        rotate: '-90deg',
      },
    }),
    vizWrapper: css({
      height: '100%',
      width: '100%',
      paddingLeft: theme.spacing(2),
    }),
    fixedSizePanel: css({
      height: '100vh',
    }),
  };
}
