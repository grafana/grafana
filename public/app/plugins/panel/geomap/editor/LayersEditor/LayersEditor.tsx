import React from 'react';
import { cx } from '@emotion/css';
import { Container, Icon, IconButton } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

import { GeomapPanelOptions } from '../../types';
import { GeomapInstanceState } from '../../GeomapPanel';
import { getLayerDragStyles } from '../../../canvas/editor/LayerElementListEditor';
import { AddLayerButton } from './AddLayerButton';

type LayersEditorProps = StandardEditorProps<any, any, GeomapPanelOptions, GeomapInstanceState>;

export const LayersEditor = (props: LayersEditorProps) => {
  const style = getLayerDragStyles(config.theme);

  const getRowStyle = (sel: boolean) => {
    return sel ? `${style.row} ${style.sel}` : style.row;
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const { layers, actions } = props.context.instanceState ?? {};
    if (!layers || !actions) {
      return;
    }

    // account for the reverse order and offset (0 is baselayer)
    const count = layers.length - 1;
    const src = (result.source.index - count) * -1;
    const dst = (result.destination.index - count) * -1;

    actions.reorder(src, dst);
  };

  const { layers, selected, actions } = props.context.instanceState ?? {};
  if (!layers || !actions) {
    return <div>No layers?</div>;
  }
  const baselayer = layers[0];

  return (
    <>
      <Container>
        <AddLayerButton actions={actions} />
      </Container>
      <br />

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
                          <span className={style.typeWrapper}>{element.options.type}</span>
                          <div className={style.textWrapper}>&nbsp; ({element.layer.getSourceState() ?? '?'})</div>

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

      {false && baselayer && (
        <>
          <label>Base layer</label>
          <div className={getRowStyle(false)}>
            <span className={style.typeWrapper}>{baselayer.options.type}</span>
            <div className={style.textWrapper}>&nbsp; {baselayer.UID}</div>
          </div>
        </>
      )}
    </>
  );
};
