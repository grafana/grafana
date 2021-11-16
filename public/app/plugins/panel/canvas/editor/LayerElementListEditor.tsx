import React, { PureComponent } from 'react';
import { css, cx } from '@emotion/css';
import { Button, Container, Icon, IconButton, stylesFactory, ValuePicker } from '@grafana/ui';
import { AppEvents, GrafanaTheme, SelectableValue, StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

import { PanelOptions } from '../models.gen';
import { LayerActionID } from '../types';
import { CanvasElementOptions, canvasElementRegistry } from 'app/features/canvas';
import appEvents from 'app/core/app_events';
import { ElementState } from 'app/features/canvas/runtime/element';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { GroupState } from 'app/features/canvas/runtime/group';
import { LayerEditorProps } from './layerEditor';
import { SelectionParams } from 'app/features/canvas/runtime/scene';
import { ShowConfirmModalEvent } from 'app/types/events';

type Props = StandardEditorProps<any, LayerEditorProps, PanelOptions>;

export class LayerElementListEditor extends PureComponent<Props> {
  style = getLayerDragStyles(config.theme);

  onAddItem = (sel: SelectableValue<string>) => {
    const { settings } = this.props.item;
    if (!settings?.layer) {
      return;
    }
    const { layer } = settings;

    const item = canvasElementRegistry.getIfExists(sel.value) ?? notFoundItem;
    const newElementOptions = item.getNewOptions() as CanvasElementOptions;
    newElementOptions.type = item.id;
    const newElement = new ElementState(item, newElementOptions, layer);
    newElement.updateSize(newElement.width, newElement.height);
    newElement.updateData(layer.scene.context);
    layer.elements.push(newElement);
    layer.scene.save();

    layer.reinitializeMoveable();
  };

  onSelect = (item: any) => {
    const { settings } = this.props.item;

    if (settings?.scene) {
      try {
        let selection: SelectionParams = { targets: [] };
        if (item instanceof GroupState) {
          const targetElements: HTMLDivElement[] = [];
          item.elements.forEach((element: ElementState) => {
            targetElements.push(element.div!);
          });

          selection.targets = targetElements;
          selection.group = item;
          settings.scene.select(selection);
        } else if (item instanceof ElementState) {
          const targetElement = [item?.div!];
          selection.targets = targetElement;
          settings.scene.select(selection);
        }
      } catch (error) {
        appEvents.emit(AppEvents.alertError, ['Unable to select element, try selecting element in panel instead']);
      }
    }
  };

  onClearSelection = () => {
    const { settings } = this.props.item;

    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    layer.scene.clearCurrentSelection();
  };

  getRowStyle = (sel: boolean) => {
    return sel ? `${this.style.row} ${this.style.sel}` : this.style.row;
  };

  onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const { settings } = this.props.item;
    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    const count = layer.elements.length - 1;
    const src = (result.source.index - count) * -1;
    const dst = (result.destination.index - count) * -1;

    layer.reorder(src, dst);
  };

  goUpLayer = () => {
    const settings = this.props.item.settings;

    if (!settings?.layer || !settings?.scene) {
      return;
    }

    const { scene, layer } = settings;

    if (layer.parent) {
      scene.updateCurrentLayer(layer.parent);
    }
  };

  private decoupleGroup = () => {
    const settings = this.props.item.settings;

    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    layer.elements.forEach((element: ElementState) => {
      layer.parent?.doAction(LayerActionID.Duplicate, element);
    });
    this.deleteGroup();
  };

  private onDecoupleGroup = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Decouple group',
        text: `Are you sure you want to decouple this group?`,
        text2: 'This will remove the group and push nested elements in the next level up.',
        confirmText: 'Yes',
        yesText: 'Decouple',
        onConfirm: async () => {
          this.decoupleGroup();
        },
      })
    );
  };

  private deleteGroup = () => {
    const settings = this.props.item.settings;

    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    layer.parent?.doAction(LayerActionID.Delete, layer);
    this.goUpLayer();
  };

  private onDeleteGroup = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete group',
        text: `Are you sure you want to delete this group?`,
        text2: 'This will delete the group and all nested elements.',
        icon: 'trash-alt',
        confirmText: 'Delete',
        yesText: 'Delete',
        onConfirm: async () => {
          this.deleteGroup();
        },
      })
    );
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
        {!layer.isRoot() && (
          <>
            <Button icon="angle-up" size="sm" variant="secondary" onClick={this.goUpLayer}>
              Go Up Level
            </Button>
            <Button size="sm" variant="secondary" onClick={() => this.onSelect(layer)}>
              Select Group
            </Button>
            <Button size="sm" variant="secondary" onClick={() => this.onDecoupleGroup()}>
              Decouple Group
            </Button>
            <Button size="sm" variant="secondary" onClick={() => this.onDeleteGroup()}>
              Delete Group
            </Button>
          </>
        )}
        <DragDropContext onDragEnd={this.onDragEnd}>
          <Droppable droppableId="droppable">
            {(provided, snapshot) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {(() => {
                  // reverse order
                  const rows: any = [];
                  for (let i = layer.elements.length - 1; i >= 0; i--) {
                    const element = layer.elements[i];
                    rows.push(
                      <Draggable key={element.UID} draggableId={`${element.UID}`} index={rows.length}>
                        {(provided, snapshot) => (
                          <div
                            className={this.getRowStyle(selection.includes(element.UID))}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onMouseDown={() => this.onSelect(element)}
                          >
                            <span className={styles.typeWrapper}>{element.item.name}</span>
                            <div className={styles.textWrapper}>
                              &nbsp; {element.UID} ({i})
                            </div>

                            {element.item.id !== 'group' && (
                              <>
                                <IconButton
                                  name="copy"
                                  title={'Duplicate'}
                                  className={styles.actionIcon}
                                  onClick={() => layer.doAction(LayerActionID.Duplicate, element)}
                                  surface="header"
                                />

                                <IconButton
                                  name="trash-alt"
                                  title={'Remove'}
                                  className={cx(styles.actionIcon, styles.dragIcon)}
                                  onClick={() => layer.doAction(LayerActionID.Delete, element)}
                                  surface="header"
                                />
                                <Icon
                                  title="Drag and drop to reorder"
                                  name="draggabledots"
                                  size="lg"
                                  className={styles.dragIcon}
                                />
                              </>
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
            <Button size="sm" variant="secondary" onClick={this.onClearSelection}>
              Clear Selection
            </Button>
          )}
        </Container>
      </>
    );
  }
}

export const getLayerDragStyles = stylesFactory((theme: GrafanaTheme) => ({
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
