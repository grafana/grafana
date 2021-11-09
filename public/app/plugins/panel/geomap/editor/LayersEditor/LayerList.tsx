import React from 'react';
import { Icon, IconButton } from '@grafana/ui';
import { cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';

import { config } from '@grafana/runtime';
import { MapLayerState } from '../../types';
import { getLayerDragStyles } from 'app/plugins/panel/canvas/editor/LayerElementListEditor';
import { GeomapLayerActions } from '../../GeomapPanel';
import { LayerHeader } from './LayerHeader';

type LayerListProps = {
  layers: Array<MapLayerState<any>>;
  onDragEnd: (result: DropResult) => void;
  selected?: number;
  actions: GeomapLayerActions;
};

export const LayerList = ({ layers, onDragEnd, selected, actions }: LayerListProps) => {
  const style = getLayerDragStyles(config.theme);

  const getRowStyle = (sel: boolean) => {
    return sel ? `${style.row} ${style.sel}` : style.row;
  };

  const onLayerNameChange = (layer: MapLayerState<any>) => {
    actions.updateLayer(layer.UID, layer);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="droppable">
        {(provided, snapshot) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {(() => {
              // reverse order
              const rows: any = [];
              for (let i = layers.length - 1; i > 0; i--) {
                const element = layers[i];
                rows.push(
                  <Draggable key={element.UID} draggableId={element.UID} index={rows.length}>
                    {(provided, snapshot) => (
                      <div
                        className={getRowStyle(i === selected)}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        onMouseDown={() => actions!.selectLayer(element.UID)}
                      >
                        <LayerHeader layer={{ ...element }} layers={layers} onChange={onLayerNameChange} />
                        <div className={style.textWrapper}>&nbsp; {element.options.type}</div>

                        <IconButton
                          name="trash-alt"
                          title={'remove'}
                          className={cx(style.actionIcon, style.dragIcon)}
                          onClick={() => actions.deleteLayer(element.UID)}
                          surface="header"
                        />
                        {layers.length > 2 && (
                          <Icon
                            title="Drag and drop to reorder"
                            name="draggabledots"
                            size="lg"
                            className={style.dragIcon}
                          />
                        )}
                      </div>
                    )}
                  </Draggable>
                );
              }
              return rows;
            })()}

            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
