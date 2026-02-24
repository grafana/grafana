import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { Sidebar, useStyles2 } from '@grafana/ui';
import { getLayoutType } from 'app/features/dashboard/utils/tracking';
import addPanelImg from 'img/dashboards/add-panel.png';

import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

import { AddAnnotationQuery } from './AddAnnotationQuery';
import { AddNewSection } from './AddNewSection';

interface AddNewEditPaneProps {
  dashboard: SceneObject;
  selectedElement: SceneObject | undefined;
  onAddPanel: () => void;
}

export function AddNewEditPane({ onAddPanel, dashboard, selectedElement }: AddNewEditPaneProps) {
  const styles = useStyles2(getStyles);
  const dashboardScene = getDashboardSceneFor(dashboard);
  const orchestrator = dashboardScene.state.layoutOrchestrator;

  const onAddPanelClick = () => {
    onAddPanel();
    DashboardInteractions.trackAddPanelClick('sidebar', getLayoutType(selectedElement));
  };

  return (
    <>
      <Sidebar.PaneHeader title={t('dashboard.add.pane-header', 'Add')} />
      <AddNewSection
        title={t('dashboard.add.new-panel.title', 'Panel')}
        description={t('dashboard.add.new-panel.description', 'Drag or click to add a panel')}
      >
        <DragDropContext onDragStart={() => orchestrator?.startDraggingNewPanel()} onDragEnd={() => {}}>
          <Droppable droppableId="side-drop-id" isDropDisabled>
            {(dropProvided) => (
              <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
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
                          onClick={onAddPanelClick}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onAddPanelClick();
                            }
                          }}
                          aria-label={t('dashboard.add.new-panel.title', 'Panel')}
                        >
                          <img
                            alt={t('dashboard.add.new-panel.button', 'Add new panel button')}
                            src={addPanelImg}
                            draggable={false}
                          />
                        </div>
                      );
                    }}
                  </Draggable>
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </AddNewSection>
      <AddNewSection title={t('dashboard-scene.dashboard-side-pane-new.dashboard-controls', 'Dashboard controls')}>
        <AddAnnotationQuery dashboardScene={dashboardScene} />
      </AddNewSection>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    dragging: css({
      cursor: 'move',
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
