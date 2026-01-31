import { css } from '@emotion/css';
import { DragDropContext, Draggable, DraggableProvidedDragHandleProps, Droppable, DropResult } from '@hello-pangea/dnd';
import { ReactNode, useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneDataLayerProvider, sceneGraph } from '@grafana/scenes';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { DashboardDataLayerSet, isDashboardDataLayerSet, isDashboardDataLayerSetState } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';
import { DataLayerControl } from './DataLayerControl';

interface DraggableLayerListProps {
  layers: SceneDataLayerProvider[];
  visibleToActualIndex: number[];
  allLayers: SceneDataLayerProvider[];
  dataLayerSet: DashboardDataLayerSet;
  renderItem: (layer: SceneDataLayerProvider, dragHandleProps: DraggableProvidedDragHandleProps | null) => ReactNode;
}

// Renders data layer controls for a dashboard
export function DashboardDataLayerControls({ dashboard }: { dashboard: DashboardScene }) {
  // We are not using the default renderer of the data objects here, because the information of where the controls
  // should be rendered (`.placement`) are set on the underlying annotation layer objects.
  const dataLayerSet = sceneGraph.getData(dashboard);
  const state = dataLayerSet.useState();
  const { isEditing } = dashboard.useState();
  const isEditingNewLayouts = isEditing && config.featureToggles.dashboardNewLayouts;
  const styles = useStyles2(getStyles);

  // It is possible to render the controls for the annotation data layers in separate places using the `placement` property.
  // In case it's not specified, we are rendering the controls here (default).
  // In edit mode, we also show hidden annotations with strikethrough styling.
  const shouldShowLayer = useCallback(
    (layer: SceneDataLayerProvider) =>
      layer.state.placement === undefined && (!layer.state.isHidden || isEditingNewLayouts),
    [isEditingNewLayouts]
  );

  // Build mapping from visible index to actual index in annotationLayers array
  const { visibleLayers, visibleToActualIndex } = useMemo(() => {
    if (!isDashboardDataLayerSetState(state)) {
      return { visibleLayers: [], visibleToActualIndex: [] };
    }

    const visible: SceneDataLayerProvider[] = [];
    const indexMap: number[] = [];

    state.annotationLayers.forEach((layer, actualIndex) => {
      if (shouldShowLayer(layer)) {
        visible.push(layer);
        indexMap.push(actualIndex);
      }
    });

    return { visibleLayers: visible, visibleToActualIndex: indexMap };
  }, [state, shouldShowLayer]);

  const renderLayerControl = useCallback(
    (layer: SceneDataLayerProvider, dragHandleProps: DraggableProvidedDragHandleProps | null) => (
      <DataLayerControl layer={layer} isEditingNewLayouts={isEditingNewLayouts} dragHandleProps={dragHandleProps} />
    ),
    [isEditingNewLayouts]
  );

  if (!isDashboardDataLayerSetState(state) || !isDashboardDataLayerSet(dataLayerSet)) {
    return null;
  }

  // When not in edit mode, render without drag and drop
  if (!isEditingNewLayouts) {
    return (
      <>
        {visibleLayers.map((layer) => (
          <div key={layer.state.key} className={styles.container}>
            <DataLayerControl layer={layer} isEditingNewLayouts={false} />
          </div>
        ))}
      </>
    );
  }

  // In edit mode, enable drag and drop
  return (
    <DraggableLayerList
      layers={visibleLayers}
      visibleToActualIndex={visibleToActualIndex}
      allLayers={state.annotationLayers}
      dataLayerSet={dataLayerSet}
      renderItem={renderLayerControl}
    />
  );
}

/**
 * A component that wraps a list of data layers with drag and drop functionality.
 * Handles reordering and state updates when layers are dragged.
 */
function DraggableLayerList({
  layers,
  visibleToActualIndex,
  allLayers,
  dataLayerSet,
  renderItem,
}: DraggableLayerListProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      const sourceVisibleIndex = result.source.index;
      const destVisibleIndex = result.destination.index;
      if (sourceVisibleIndex === destVisibleIndex) {
        return;
      }

      // Map visible indices back to actual indices
      const sourceActualIndex = visibleToActualIndex[sourceVisibleIndex];
      const destActualIndex = visibleToActualIndex[destVisibleIndex];

      // Reorder the full annotation layers array
      const reorderedLayers = [...allLayers];
      const [removed] = reorderedLayers.splice(sourceActualIndex, 1);

      // Adjust destination index if source was before destination
      const adjustedDestIndex = sourceActualIndex < destActualIndex ? destActualIndex : destActualIndex;
      reorderedLayers.splice(adjustedDestIndex, 0, removed);

      dataLayerSet.setState({ annotationLayers: reorderedLayers });
    },
    [allLayers, dataLayerSet, visibleToActualIndex]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="annotation-layers" direction="horizontal">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className={styles.droppableContainer}>
            {layers.map((layer, index) => (
              <Draggable key={layer.state.key!} draggableId={layer.state.key!} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={styles.container}
                    style={{
                      ...provided.draggableProps.style,
                      background: snapshot.isDragging ? theme.colors.background.secondary : undefined,
                      borderRadius: snapshot.isDragging ? theme.shape.radius.default : undefined,
                    }}
                  >
                    {renderItem(layer, provided.dragHandleProps)}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  droppableContainer: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
  }),
  container: css({
    label: 'dashboard-data-layer-controls',
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});
