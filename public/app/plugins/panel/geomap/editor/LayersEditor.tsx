import React, { PureComponent } from 'react';
import { cx } from '@emotion/css';
import { Container, Icon, IconButton, ValuePicker } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

import { GeomapPanelOptions } from '../types';
import { GeomapInstanceState } from '../GeomapPanel';
import { geomapLayerRegistry } from '../layers/registry';
import { getLayerDragStyles } from '../../canvas/editor/LayerElementListEditor';
import { dataLayerFilter } from './layerEditor';

type Props = StandardEditorProps<any, any, GeomapPanelOptions, GeomapInstanceState>;

export class LayersEditor extends PureComponent<Props> {
  style = getLayerDragStyles(config.theme);

  getRowStyle = (sel: boolean) => {
    return sel ? `${this.style.row} ${this.style.sel}` : this.style.row;
  };

  onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const { layers, actions } = this.props.context.instanceState ?? {};
    if (!layers || !actions) {
      return;
    }

    // account for the reverse order and offset (0 is baselayer)
    const count = layers.length - 1;
    const src = (result.source.index - count) * -1;
    const dst = (result.destination.index - count) * -1;

    actions.reorder(src, dst);
  };

  render() {
    const { layers, selected, actions } = this.props.context.instanceState ?? {};
    if (!layers || !actions) {
      return <div>No layers?</div>;
    }
    const baselayer = layers[0];

    const styles = this.style;
    return (
      <>
        <Container>
          <ValuePicker
            icon="plus"
            label="Add layer"
            variant="secondary"
            options={geomapLayerRegistry.selectOptions(undefined, dataLayerFilter).options}
            onChange={(v) => actions.addlayer(v.value!)}
            isFullWidth={true}
          />
        </Container>
        <br />

        <DragDropContext onDragEnd={this.onDragEnd}>
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
                            className={this.getRowStyle(i === selected)}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onMouseDown={() => actions!.selectLayer(element.UID)}
                          >
                            <span className={styles.typeWrapper}>{element.options.type}</span>
                            <div className={styles.textWrapper}>&nbsp; ({element.layer.getSourceState() ?? '?'})</div>

                            <IconButton
                              name="trash-alt"
                              title={'remove'}
                              className={cx(styles.actionIcon, styles.dragIcon)}
                              onClick={() => actions.deleteLayer(element.UID)}
                              surface="header"
                            />
                            {layers.length > 2 && (
                              <Icon
                                title="Drag and drop to reorder"
                                name="draggabledots"
                                size="lg"
                                className={styles.dragIcon}
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
            <div className={this.getRowStyle(false)}>
              <span className={styles.typeWrapper}>{baselayer.options.type}</span>
              <div className={styles.textWrapper}>&nbsp; {baselayer.UID}</div>
            </div>
          </>
        )}
      </>
    );
  }
}
