import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneComponentProps, sceneGraph, SceneObjectBase } from '@grafana/scenes';
import { ScrollContainer, Sidebar, useStyles2 } from '@grafana/ui';
import addPanelSvg from 'img/dashboards/add-panel.svg';

import { useClipboardState } from '../../scene/layouts-shared/useClipboardState';
import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardEditPane } from '../DashboardEditPane';

import { AddAnnotationQuery } from './AddAnnotationQuery';
import { AddButton } from './AddButton';
import { AddFilters } from './AddFilters';
import { AddLink } from './AddLink';
import { AddNewSection } from './AddNewSection';
import { AddRow } from './AddRow';
import { AddTab } from './AddTab';
import { AddVariable } from './AddVariable';

export class AddNewEditPane extends SceneObjectBase {
  public static Component = AddNewEditPaneRenderer;
  public getId() {
    return 'add' as const;
  }
}

export function AddNewEditPaneRenderer({ model }: SceneComponentProps<AddNewEditPane>) {
  const editPane = sceneGraph.getAncestor(model, DashboardEditPane);
  const { hasCopiedPanel } = useClipboardState();
  const styles = useStyles2(getStyles);
  const dashboardScene = getDashboardSceneFor(model);
  const orchestrator = dashboardScene.state.layoutOrchestrator;
  const selectedObj = editPane.getSelectedObject();

  const onStartDragging = (result: { draggableId: string }) => {
    const mode = result.draggableId === 'paste-panel-drag' ? 'paste' : 'newPanel';
    orchestrator.startDraggingNewPanel(mode);
  };

  return (
    <div className={styles.wrapper}>
      <Sidebar.PaneHeader title={t('dashboard.add.pane-header', 'Add')} />
      <ScrollContainer showScrollIndicators={true}>
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
                          onClick={() => editPane.addNewPanel(selectedObj)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              editPane.addNewPanel(selectedObj);
                            }
                          }}
                          aria-label={t('dashboard.add.new-panel.title', 'Panel')}
                        >
                          <img
                            alt={t('dashboard.add.new-panel.button', 'Add new panel button')}
                            src={addPanelSvg}
                            draggable={false}
                          />
                        </div>
                      );
                    }}
                  </Draggable>
                  {hasCopiedPanel && (
                    <Draggable
                      draggableId="paste-panel-drag"
                      index={1}
                      isDragDisabled={!hasCopiedPanel}
                      disableInteractiveElementBlocking={true}
                    >
                      {(dragProvided, _) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                        >
                          <AddButton
                            className={styles.pasteButton}
                            icon="clipboard-alt"
                            tabIndex={0}
                            onClick={() => editPane.pastePanel(selectedObj)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                editPane.pastePanel(selectedObj);
                              }
                            }}
                            aria-label={t('dashboard.canvas-actions.add.paste.title', 'Paste panel')}
                            label={t('dashboard.canvas-actions.add.paste.title', 'Paste panel')}
                            tooltip={t(
                              'dashboard.canvas-actions.add.paste.description',
                              'Click or drag to paste panel'
                            )}
                          ></AddButton>
                        </div>
                      )}
                    </Draggable>
                  )}
                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </AddNewSection>
        <AddNewSection title={t('dashboard-scene.add-new-edit-pane.group-layouts', 'Group layouts')}>
          <AddRow dashboardScene={dashboardScene} selectedElement={selectedObj} />
          <AddTab dashboardScene={dashboardScene} selectedElement={selectedObj} />
        </AddNewSection>
        <AddNewSection title={t('dashboard-scene.dashboard-side-pane-new.dashboard-controls', 'Dashboard controls')}>
          {config.featureToggles.dashboardUnifiedDrilldownControls && <AddFilters dashboardScene={dashboardScene} />}
          <AddVariable dashboardScene={dashboardScene} selectedElement={selectedObj} />
          <AddAnnotationQuery dashboardScene={dashboardScene} />
          <AddLink dashboardScene={dashboardScene} />
        </AddNewSection>
      </ScrollContainer>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      height: '100%',
    }),
    dragging: css({
      cursor: 'move',
    }),
    imageContainer: css({
      cursor: 'pointer',
      width: '100%',
      opacity: 0.8,
      overflow: 'hidden',
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.medium}`,
      background: theme.colors.background.secondary,
      '&:hover': {
        opacity: 1,
      },
      img: {
        display: 'block',
        width: 'auto',
        maxWidth: '100%',
        height: 'auto',
        maxHeight: theme.spacing(9),
        marginLeft: 'auto',
        marginRight: 'auto',
      },
    }),
    pasteButton: css({
      width: '100%',
      marginTop: theme.spacing(2),
    }),
  };
}
