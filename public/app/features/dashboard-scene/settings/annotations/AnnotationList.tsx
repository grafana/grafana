import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { SceneDataLayerProvider } from '@grafana/scenes';
import { Box, Button, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

import { partitionAnnotationLayers } from './AnnotationSetEditableElement';

export function AnnotationList({ dataLayerSet }: { dataLayerSet: DashboardDataLayerSet }) {
  const { annotationLayers } = dataLayerSet.useState();
  const styles = useStyles2(getStyles);
  const canAdd = dataLayerSet.parent instanceof DashboardScene;

  const onSelectAnnotation = useCallback(
    (layer: SceneDataLayerProvider) => {
      const { editPane } = getDashboardSceneFor(dataLayerSet).state;
      editPane.selectObject(layer, layer.state.key!);
    },
    [dataLayerSet]
  );

  const onAddAnnotation = useCallback(() => {
    const newAnnotation = dataLayerSet.createDefaultAnnotationLayer();

    dashboardEditActions.addAnnotation({
      source: dataLayerSet,
      addedObject: newAnnotation,
    });

    DashboardInteractions.addAnnotationButtonClicked({ source: 'edit_pane' });
  }, [dataLayerSet]);

  const { standardLayers, controlsMenuLayers } = useMemo(
    () => partitionAnnotationLayers(annotationLayers),
    [annotationLayers]
  );

  const createDragEndHandler = useCallback(
    (
      sourceList: SceneDataLayerProvider[],
      mergeLists: (updatedList: SceneDataLayerProvider[]) => SceneDataLayerProvider[]
    ) => {
      return (result: DropResult) => {
        const currentList = dataLayerSet.state.annotationLayers;

        dashboardEditActions.edit({
          source: dataLayerSet,
          description: t(
            'dashboard-scene.annotation-list.create-drag-end-handler.description.reorder-annotations-list',
            'Reorder annotations list'
          ),
          perform: () => {
            if (!result.destination || result.destination.index === result.source.index) {
              return;
            }

            const updatedList = [...sourceList];
            const [movedLayer] = updatedList.splice(result.source.index, 1);
            updatedList.splice(result.destination.index, 0, movedLayer);

            dataLayerSet.setState({ annotationLayers: mergeLists(updatedList) });
            DashboardInteractions.annotationsReordered({ source: 'edit_pane' });
          },
          undo: () => {
            dataLayerSet.setState({ annotationLayers: currentList });
          },
        });
      };
    },
    [dataLayerSet]
  );

  const onStandardDragEnd = useMemo(
    () => createDragEndHandler(standardLayers, (updatedList) => [...updatedList, ...controlsMenuLayers]),
    [controlsMenuLayers, createDragEndHandler, standardLayers]
  );

  const onControlsDragEnd = useMemo(
    () => createDragEndHandler(controlsMenuLayers, (updatedList) => [...standardLayers, ...updatedList]),
    [controlsMenuLayers, createDragEndHandler, standardLayers]
  );

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.stopPropagation();
  }, []);

  const renderList = (list: SceneDataLayerProvider[], droppableId: string) => (
    <Droppable droppableId={droppableId} direction="vertical">
      {(provided) => (
        <Stack ref={provided.innerRef} {...provided.droppableProps} direction="column" gap={0}>
          {list.map((layer, index) => (
            <Draggable key={layer.state.key} draggableId={`${layer.state.key}`} index={index}>
              {(draggableProvided) => (
                <div
                  key={layer.state.key}
                  className={styles.annotationItem}
                  ref={draggableProvided.innerRef}
                  {...draggableProvided.draggableProps}
                >
                  <div
                    className={styles.annotationContent}
                    aria-label={t('dashboard-scene.annotation-list.render-list.aria-label-annotation', 'Annotation')}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectAnnotation(layer)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectAnnotation(layer);
                      }
                    }}
                  >
                    <div {...draggableProvided.dragHandleProps} onPointerDown={onPointerDown}>
                      <Tooltip
                        content={t('dashboard.edit-pane.annotations.reorder', 'Drag to reorder')}
                        placement="top"
                      >
                        <Icon name="draggabledots" size="md" className={styles.dragHandle} />
                      </Tooltip>
                    </div>
                    <Text truncate>{layer.state.name}</Text>
                    {layer.state.isHidden && <Icon name="eye-slash" size="sm" className={styles.hiddenIcon} />}
                    {layer.state.placement === 'inControlsMenu' && (
                      <Icon name="sliders-v-alt" size="sm" className={styles.hiddenIcon} />
                    )}
                  </div>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Button variant="primary" size="sm" fill="outline">
                      <Trans i18nKey="dashboard.edit-pane.annotations.select-annotation">Select</Trans>
                    </Button>
                  </Stack>
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </Stack>
      )}
    </Droppable>
  );

  return (
    <Stack direction="column" gap={0}>
      <DragDropContext onDragEnd={onStandardDragEnd}>
        {renderList(standardLayers, 'annotations-outline-standard')}
      </DragDropContext>
      {controlsMenuLayers.length > 0 && (
        <DragDropContext onDragEnd={onControlsDragEnd}>
          {renderList(controlsMenuLayers, 'annotations-outline-controls')}
        </DragDropContext>
      )}
      {canAdd && (
        <Box paddingBottom={1} paddingTop={1} display={'flex'}>
          <Button
            fullWidth
            icon="plus"
            size="sm"
            variant="secondary"
            onClick={onAddAnnotation}
            data-testid={selectors.components.PanelEditor.ElementEditPane.addAnnotationButton}
          >
            <Trans i18nKey="dashboard.edit-pane.annotations.add-annotation">Add annotation</Trans>
          </Button>
        </Box>
      )}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    annotationItem: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      '&:last-child': {
        marginBottom: theme.spacing(2),
      },
      button: {
        visibility: 'hidden',
      },
      '&:hover': {
        color: theme.colors.text.link,
        button: {
          visibility: 'visible',
        },
      },
    }),
    annotationContent: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    dragHandle: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'grab',
      color: theme.colors.text.secondary,
      '&:active': {
        cursor: 'grabbing',
      },
    }),
    hiddenIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
  };
}
