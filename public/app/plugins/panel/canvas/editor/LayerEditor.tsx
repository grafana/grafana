import React, { PureComponent } from 'react';
import { css, cx } from '@emotion/css';
import { Button, Container, Icon, IconButton, stylesFactory, ValuePicker } from '@grafana/ui';
import { GrafanaTheme, SelectableValue, StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

import { Unsubscribable } from 'rxjs';
import { PanelOptions } from '../models.gen';
import { InstanceState } from '../CanvasPanel';
import { LayerActionID } from '../types';
import { ElementState } from 'app/features/canvas/runtime/element';
import { canvasElementRegistry } from 'app/features/canvas';

// StandardEditorProps<any, >>

type Props = StandardEditorProps<any, InstanceState, PanelOptions>;
interface State {
  // selection: string[];
}

export class LayerEditor extends PureComponent<Props, State> {
  style = getStyles(config.theme);
  sub: Unsubscribable | undefined;

  constructor(props: Props) {
    super(props);
    this.state = { selection: [] };
    console.log('constructor (LayerEditor)');
  }

  //   private selectionInit = () => {
  //     console.log('selectionInit (ListItemsEditor)');
  //     const scene = getCurrentScene();
  //     if (!scene) {
  //       setTimeout(this.selectionInit, 150);
  //       return;
  //     }
  //     this.sub = scene.getSelection().subscribe({
  //       next: (selection: string[]) => {
  //         console.log('ListItemEditor> ITEM', selection);
  //         this.setState({ selection });
  //       },
  //     });
  //   };

  //   componentDidMount() {
  //     this.selectionInit();
  //   }

  //   componentWillUnmount() {
  //     if (this.sub) {
  //       this.sub.unsubscribe();
  //     }
  //   }

  onAddItem = (sel: SelectableValue<string>) => {
    // const reg = drawItemsRegistry.getIfExists(sel.value);
    // if (!reg) {
    //   console.error('NOT FOUND', sel);
    //   return;
    // }
    // const layer = this.props.value;
    // const item = newItem(reg, layer.items.length);
    // const isList = this.props.context.options?.mode === LayoutMode.List;
    // const items = isList ? [item, ...layer.items] : [...layer.items, item];
    // this.props.onChange({
    //   ...layer,
    //   items,
    // });
    // this.onSelect(item);
  };

  onSelect = (item: any) => {
    //  getCurrentScene()?.selectItem(item.id);
    console.log('SELECT', item);
  };

  getRowStyle = (sel: boolean) => {
    return sel ? `${this.style.row} ${this.style.sel}` : this.style.row;
  };

  onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const layer = this.props.value;
    const count = layer.items.length - 1;
    const src = (result.source.index - count) * -1;
    const dst = (result.destination.index - count) * -1;

    const items = reorder(layer.items, src, dst);
    this.props.onChange({
      ...layer,
      items,
    });
  };

  doAction = (action: string, item: ElementState) => {
    // const v = layerActions.getIfExists(action);
    // if (!v) {
    //   console.log('UNKNOWN action', action);
    //   return;
    // }
    // const layer = v.apply(this.props.value, item);
    // this.props.onChange(layer);
    console.log('DO action', action, item);
  };

  render() {
    const settings = this.props.item.settings;
    if (!settings) {
      return <div>No settings</div>;
    }
    const layer = settings.layer;
    if (!layer) {
      return <div>Missing layer?</div>;
    }

    const styles = this.style;
    const selection: number[] = settings.selected ? settings.selected.map((v) => v.UID) : [];
    return (
      <>
        <DragDropContext onDragEnd={this.onDragEnd}>
          <Droppable droppableId="droppable">
            {(provided, snapshot) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {(() => {
                  // reverse order
                  const rows: any = [];
                  for (let i = layer.elements.length - 1; i >= 0; i--) {
                    const item = layer.elements[i];
                    rows.push(
                      <Draggable key={item.UID} draggableId={`${item.UID}`} index={rows.length}>
                        {(provided, snapshot) => (
                          <div
                            className={this.getRowStyle(selection.includes(item.UID))}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onMouseDown={() => this.onSelect(item)}
                          >
                            <span className={styles.typeWrapper}>{item.item.name}</span>
                            <div className={styles.textWrapper}>
                              &nbsp; {item.UID} ({i})
                            </div>

                            <IconButton
                              name="copy"
                              title={'duplicate'}
                              className={styles.actionIcon}
                              onClick={() => this.doAction(LayerActionID.Duplicate, item)}
                              surface="header"
                            />

                            <IconButton
                              name="trash-alt"
                              title={'remove'}
                              className={cx(styles.actionIcon, styles.dragIcon)}
                              onClick={() => this.doAction(LayerActionID.Delete, item)}
                              surface="header"
                            />
                            <Icon
                              title="Drag and drop to reorder"
                              name="draggabledots"
                              size="lg"
                              className={styles.dragIcon}
                            />
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
        <br />

        <Container>
          <ValuePicker
            icon="plus"
            label="Add item"
            variant="secondary"
            options={canvasElementRegistry.selectOptions().options}
            onChange={this.onAddItem}
            isFullWidth={false}
          />
          {selection.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => console.log('TODO!')}>
              Clear Selection
            </Button>
          )}
        </Container>
      </>
    );
  }
}

// a little function to help us with reordering the result
const reorder = (list: any[], startIndex: number, endIndex: number) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    margin-bottom: ${theme.spacing.md};
  `,
  row: css`
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    border-radius: ${theme.border.radius.sm};
    background: ${theme.colors.bg2};
    min-height: ${theme.spacing.formInputHeight}px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 3px;
    cursor: pointer;

    border: 1px solid ${theme.colors.formInputBorder};
    &:hover {
      border: 1px solid ${theme.colors.formInputBorderHover};
    }
  `,
  sel: css`
    border: 1px solid ${theme.colors.formInputBorderActive};
    &:hover {
      border: 1px solid ${theme.colors.formInputBorderActive};
    }
  `,
  dragIcon: css`
    cursor: drag;
  `,
  actionIcon: css`
    color: ${theme.colors.textWeak};
    &:hover {
      color: ${theme.colors.text};
    }
  `,
  typeWrapper: css`
    color: ${theme.colors.textBlue};
    margin-right: 5px;
  `,
  textWrapper: css`
    display: flex;
    align-items: center;
    flex-grow: 1;
    overflow: hidden;
    margin-right: ${theme.spacing.sm};
  `,
}));
