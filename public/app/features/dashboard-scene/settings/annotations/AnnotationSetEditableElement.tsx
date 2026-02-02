import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback, useId, useMemo } from 'react';

import { AnnotationQuery, getDataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneDataLayerProvider, SceneObject } from '@grafana/scenes';
import { Box, Button, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

import { newAnnotationName } from './AnnotationSettingsEdit';

function partitionAnnotationLayers(layers: SceneDataLayerProvider[]) {
  const standardLayers: SceneDataLayerProvider[] = [];
  const controlsMenuLayers: SceneDataLayerProvider[] = [];

  layers.forEach((layer) => {
    if (layer.state.placement === 'inControlsMenu') {
      controlsMenuLayers.push(layer);
    } else {
      standardLayers.push(layer);
    }
  });

  return { standardLayers, controlsMenuLayers };
}

function useEditPaneOptions(
  this: AnnotationSetEditableElement,
  dataLayerSet: DashboardDataLayerSet
): OptionsPaneCategoryDescriptor[] {
  const annotationListId = useId();

  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'annotations' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: annotationListId,
        skipField: true,
        render: () => <AnnotationList dataLayerSet={dataLayerSet} />,
      })
    );
  }, [annotationListId, dataLayerSet]);

  return [options];
}

export class AnnotationSetEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private dataLayerSet: DashboardDataLayerSet) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.annotation-set', 'Annotations & Alerts'),
      icon: 'comment-alt',
      instanceName: t('dashboard.edit-pane.elements.annotation-set', 'Annotations & Alerts'),
      isHidden: this.dataLayerSet.state.annotationLayers.length === 0,
    };
  }

  public getOutlineChildren(): SceneObject[] {
    const { standardLayers, controlsMenuLayers } = partitionAnnotationLayers(this.dataLayerSet.state.annotationLayers);
    return [...standardLayers, ...controlsMenuLayers];
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.dataLayerSet);
}

function AnnotationList({ dataLayerSet }: { dataLayerSet: DashboardDataLayerSet }) {
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
    const defaultDatasource = getDataSourceSrv().getInstanceSettings(null);
    const datasourceRef = defaultDatasource?.meta.annotations ? getDataSourceRef(defaultDatasource) : undefined;

    const newAnnotationQuery: AnnotationQuery = {
      name: newAnnotationName,
      enable: true,
      datasource: datasourceRef,
      iconColor: 'red',
    };

    const newAnnotation = new DashboardAnnotationsDataLayer({
      query: newAnnotationQuery,
      name: newAnnotationQuery.name,
      isEnabled: Boolean(newAnnotationQuery.enable),
      isHidden: Boolean(newAnnotationQuery.hide),
    });

    dataLayerSet.addAnnotationLayer(newAnnotation);

    // Select the newly added annotation
    const { editPane } = getDashboardSceneFor(dataLayerSet).state;
    editPane.selectObject(newAnnotation, newAnnotation.state.key!);
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
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
                <div
                  className={styles.annotationItem}
                  key={layer.state.key}
                  onClick={() => onSelectAnnotation(layer)}
                  ref={draggableProvided.innerRef}
                  {...draggableProvided.draggableProps}
                >
                  <div className={styles.annotationContent}>
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
          <Button fullWidth icon="plus" size="sm" variant="secondary" onClick={onAddAnnotation}>
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
