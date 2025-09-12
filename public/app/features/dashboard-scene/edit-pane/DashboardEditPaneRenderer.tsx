import { css, cx } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { useSceneObjectState } from '@grafana/scenes';
import { useStyles2, useSplitter, ToolbarButton, ScrollContainer, Text, Icon, clearButtonStyles } from '@grafana/ui';

import { DashboardInteractions } from '../utils/interactions';

import { DashboardEditPane } from './DashboardEditPane';
import { DashboardOutline } from './DashboardOutline';
import { ElementEditPane } from './ElementEditPane';
import { useEditableElement } from './useEditableElement';

export interface Props {
  editPane: DashboardEditPane;
  isCollapsed: boolean;
  openOverlay?: boolean;
  onToggleCollapse: () => void;
}

/**
 * Making the EditPane rendering completely standalone (not using editPane.Component) in order to pass custom react props
 */
export function DashboardEditPaneRenderer({ editPane, isCollapsed, onToggleCollapse, openOverlay }: Props) {
  const { selection } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const styles = useStyles2(getStyles);
  const clearButton = useStyles2(clearButtonStyles);
  const editableElement = useEditableElement(selection, editPane);
  const selectedObject = selection?.getFirstObject();

  const isNewElement = selection?.isNewElement() ?? false;
  const [outlineCollapsed, setOutlineCollapsed] = useLocalStorage(
    'grafana.dashboard.edit-pane.outline.collapsed',
    true
  );
  const [outlinePaneSize = 0.4, setOutlinePaneSize] = useLocalStorage('grafana.dashboard.edit-pane.outline.size', 0.4);

  // splitter for template and payload editor
  const splitter = useSplitter({
    direction: 'column',
    handleSize: 'sm',
    // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
    initialSize: 1 - outlinePaneSize,
    dragPosition: 'middle',
    onSizeChanged: (size) => {
      setOutlinePaneSize(1 - size);
    },
  });

  if (!editableElement) {
    return null;
  }

  if (isCollapsed) {
    return (
      <>
        <div className={styles.expandOptionsWrapper}>
          <ToolbarButton
            tooltip={t('dashboard.edit-pane.open', 'Open options pane')}
            icon="arrow-to-right"
            onClick={onToggleCollapse}
            variant="canvas"
            narrow={true}
            className={styles.rotate180}
            aria-label={t('dashboard.edit-pane.open', 'Open options pane')}
          />
        </div>

        {openOverlay && (
          <Resizable className={styles.overlayWrapper} defaultSize={{ height: '100%', width: '300px' }}>
            <ElementEditPane
              element={editableElement}
              key={selectedObject?.state.key}
              editPane={editPane}
              isNewElement={isNewElement}
            />
          </Resizable>
        )}
      </>
    );
  }

  if (outlineCollapsed) {
    splitter.primaryProps.style.flexGrow = 1;
    splitter.primaryProps.style.minHeight = 'unset';
    splitter.secondaryProps.style.flexGrow = 0;
    splitter.secondaryProps.style.minHeight = 'min-content';
  } else {
    splitter.primaryProps.style.minHeight = 'unset';
    splitter.secondaryProps.style.minHeight = 'unset';
  }

  return (
    <div className={styles.wrapper}>
      <div {...splitter.containerProps}>
        <div {...splitter.primaryProps} className={cx(splitter.primaryProps.className, styles.paneContent)}>
          <ElementEditPane
            element={editableElement}
            key={selectedObject?.state.key}
            editPane={editPane}
            isNewElement={isNewElement}
          />
        </div>
        <div
          {...splitter.splitterProps}
          className={cx(splitter.splitterProps.className, styles.splitter)}
          data-edit-pane-splitter={true}
        />
        <div {...splitter.secondaryProps} className={cx(splitter.secondaryProps.className, styles.paneContent)}>
          <button
            type="button"
            onClick={() => {
              DashboardInteractions.dashboardOutlineClicked();
              setOutlineCollapsed(!outlineCollapsed);
            }}
            className={cx(clearButton, styles.outlineCollapseButton)}
            data-testid={selectors.components.PanelEditor.Outline.section}
          >
            <Text weight="medium">
              <Trans i18nKey="dashboard-scene.dashboard-edit-pane-renderer.outline">Outline</Trans>
            </Text>
            <Icon name={outlineCollapsed ? 'angle-up' : 'angle-down'} />
          </button>
          {!outlineCollapsed && (
            <div className={styles.outlineContainer}>
              <ScrollContainer showScrollIndicators={true}>
                <DashboardOutline editPane={editPane} />
              </ScrollContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      marginTop: theme.spacing(2),
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      borderTopLeftRadius: theme.shape.radius.default,
    }),
    overlayWrapper: css({
      right: 0,
      bottom: 0,
      top: theme.spacing(2),
      position: 'absolute !important' as 'absolute',
      background: theme.colors.background.primary,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z3,
      zIndex: theme.zIndex.navbarFixed,
      flexGrow: 1,
    }),
    paneContent: css({
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }),
    rotate180: css({
      rotate: '180deg',
    }),
    tabsbar: css({
      padding: theme.spacing(0, 1),
      margin: theme.spacing(0.5, 0),
    }),
    expandOptionsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 1, 2, 0),
    }),
    splitter: css({
      '&::after': {
        background: 'transparent',
        transform: 'unset',
        width: '100%',
        height: '1px',
        top: '100%',
        left: '0',
      },
    }),
    outlineCollapseButton: css({
      display: 'flex',
      padding: theme.spacing(0.5, 2),
      gap: theme.spacing(1),
      justifyContent: 'space-between',
      alignItems: 'center',
      background: theme.colors.background.secondary,

      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    outlineContainer: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'hidden',
    }),
  };
}
