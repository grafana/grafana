import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { Sidebar, Text, useStyles2 } from '@grafana/ui';
import addPanelImg from 'img/dashboards/add-panel.png';

import { getDashboardSceneFor } from '../utils/utils';

export function DashboardSidePaneNew({ onAddPanel, dashboard }: { onAddPanel: () => void; dashboard: SceneObject }) {
  const styles = useStyles2(getStyles);
  const orchestrator = getDashboardSceneFor(dashboard).state.layoutOrchestrator;

  return (
    <DragDropContext onDragStart={() => orchestrator?.startDraggingNewPanel()} onDragEnd={() => {}}>
      <Droppable droppableId="side-drop-id" isDropDisabled>
        {(dropProvided) => (
          <div className={styles.sidePanel} ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
            <Sidebar.PaneHeader title={t('dashboard.add.pane-header', 'Add')} />
            <div className={styles.sidePanelContainer}>
              <Text weight="medium">{t('dashboard.add.new-panel.title', 'Panel')}</Text>
              <Text variant="bodySmall">
                {t('dashboard.add.new-panel.description', 'Drag or click to add a panel')}
              </Text>
              <div className={styles.dragContainer}>
                <Draggable draggableId="new-panel-drag" index={0}>
                  {(dragProvided, dragSnapshot) => {
                    return (
                      <div
                        role="button"
                        data-testid={selectors.components.Sidebar.newPanelButton}
                        tabIndex={0}
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={cx(styles.imageContainer, dragSnapshot.isDragging && styles.dragging)}
                        onClick={onAddPanel}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onAddPanel();
                          }
                        }}
                        aria-label={t('dashboard.add.new-panel.title', 'Panel')}
                      >
                        <img alt="Add panel click area" src={addPanelImg} draggable={false} />
                      </div>
                    );
                  }}
                </Draggable>
              </div>
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sidePanel: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    dragging: css({
      cursor: 'move',
    }),
    sidePanelContainer: css({
      padding: theme.spacing(2),
      span: {
        display: 'block',
      },
    }),
    dragContainer: css({
      height: 150,
    }),
    imageContainer: css({
      cursor: 'pointer',
      opacity: 0.8,
      overflow: 'hidden',
      padding: theme.spacing(2, 0),
      borderRadius: theme.shape.radius.sm,
      width: '100%',
      '&:hover': {
        opacity: 1,
      },
    }),
  };
}
