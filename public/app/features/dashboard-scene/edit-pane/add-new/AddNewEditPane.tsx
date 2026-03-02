import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { Button, Sidebar, useStyles2, useTheme2 } from '@grafana/ui';
import addPanelImg from 'img/dashboards/add-panel.png';

import { useClipboardState } from '../../scene/layouts-shared/useClipboardState';
import { getDashboardSceneFor } from '../../utils/utils';

import { AddAnnotationQuery } from './AddAnnotationQuery';
import { getNewButtonStyles } from './AddButton';
import { AddNewSection } from './AddNewSection';
import { AddVariable } from './AddVariable';

interface AddNewEditPaneProps {
  dashboard: SceneObject;
  selectedElement: SceneObject | undefined;
  onAddPanel: () => void;
  onPastePanel: () => void;
}

export function AddNewEditPane({ onAddPanel, onPastePanel, dashboard, selectedElement }: AddNewEditPaneProps) {
  const { hasCopiedPanel } = useClipboardState();
  const styles = useStyles2(getStyles);
  const dashboardScene = getDashboardSceneFor(dashboard);
  const orchestrator = dashboardScene.state.layoutOrchestrator;
  const theme = useTheme2();

  const onStartDragging = (result: { draggableId: string }) => {
    const mode = result.draggableId === 'paste-panel-drag' ? 'paste' : 'newPanel';
    orchestrator?.startDraggingNewPanel(mode);
  };

  return (
    <>
      <Sidebar.PaneHeader title={t('dashboard.add.pane-header', 'Add')} />
      <AddNewSection
        title={t('dashboard.add.new-panel.title', 'Panel')}
        description={t('dashboard.add.new-panel.description', 'Drag or click to add a panel')}
      >
        <DragDropContext onDragStart={onStartDragging} onDragEnd={() => {}}>
          <Droppable droppableId="side-drop-id" isDropDisabled>
            {(dropProvided) => (
              <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
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
                        <img
                          alt={t('dashboard.add.new-panel.button', 'Add new panel button')}
                          src={addPanelImg}
                          draggable={false}
                        />
                      </div>
                    );
                  }}
                </Draggable>
                <Draggable draggableId="paste-panel-drag" index={1} isDragDisabled={!hasCopiedPanel}>
                  {(dragProvided, _) => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                      {hasCopiedPanel ? (
                        <Button
                          variant="secondary"
                          fill="outline"
                          className={getNewButtonStyles(theme).iconButton}
                          {...dragProvided.dragHandleProps}
                          role="button"
                          icon="clipboard-alt"
                          size="lg"
                          tabIndex={0}
                          onClick={onPastePanel}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onPastePanel();
                            }
                          }}
                          aria-label={t('dashboard.canvas-actions.add.paste.title', 'Paste panel')}
                          tooltip={t('dashboard.canvas-actions.add.paste.description', 'Click or drag to paste panel')}
                        >
                          {t('dashboard.canvas-actions.add.paste.title', 'Paste panel')}
                        </Button>
                      ) : (
                        <div className={styles.placeholder} aria-hidden />
                      )}
                    </div>
                  )}
                </Draggable>
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </AddNewSection>
      <AddNewSection title={t('dashboard-scene.dashboard-side-pane-new.dashboard-controls', 'Dashboard controls')}>
        <AddVariable dashboardScene={dashboardScene} />
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
    imageContainer: css({
      cursor: 'pointer',
      opacity: 0.8,
      overflow: 'hidden',
      borderRadius: theme.shape.radius.sm,
      width: '100%',
      '&:hover': {
        opacity: 1,
      },
    }),
    placeholder: css({
      display: 'none',
    }),
  };
}
