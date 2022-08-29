import { css, cx } from '@emotion/css';
import React from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';

import { GrafanaTheme } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, IconButton, stylesFactory } from '@grafana/ui';

import { LayerName } from './LayerName';
import { LayerElement } from './types';

export const DATA_TEST_ID = 'layer-drag-drop-list';

export type LayerDragDropListProps<T extends LayerElement> = {
  layers: T[];
  getLayerInfo: (element: T) => string;
  onDragEnd: (result: DropResult) => void;
  onSelect: (element: T) => any;
  onDelete: (element: T) => any;
  onDuplicate?: (element: T) => any;
  showActions: (element: T) => boolean;
  selection?: string[]; // list of unique ids (names)
  excludeBaseLayer?: boolean;
  onNameChange: (element: T, newName: string) => any;
  verifyLayerNameUniqueness?: (nameToCheck: string) => boolean;
};

export const LayerDragDropList = <T extends LayerElement>({
  layers,
  getLayerInfo,
  onDragEnd,
  onSelect,
  onDelete,
  onDuplicate,
  showActions,
  selection,
  excludeBaseLayer,
  onNameChange,
  verifyLayerNameUniqueness,
}: LayerDragDropListProps<T>) => {
  const style = styles(config.theme);

  const getRowStyle = (isSelected: boolean) => {
    return isSelected ? `${style.row} ${style.sel}` : style.row;
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="droppable">
        {(provided, snapshot) => (
          <div {...provided.droppableProps} ref={provided.innerRef} data-testid={DATA_TEST_ID}>
            {(() => {
              // reverse order
              const rows: JSX.Element[] = [];
              const lastLayerIndex = excludeBaseLayer ? 1 : 0;
              const shouldRenderDragIconLengthThreshold = excludeBaseLayer ? 2 : 1;
              for (let i = layers.length - 1; i >= lastLayerIndex; i--) {
                const element = layers[i];
                const uid = element.getName();

                const isSelected = Boolean(selection?.includes(uid));
                rows.push(
                  <Draggable key={uid} draggableId={uid} index={rows.length}>
                    {(provided, snapshot) => (
                      <div
                        className={getRowStyle(isSelected)}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        onMouseDown={() => onSelect(element)}
                      >
                        <LayerName
                          name={uid}
                          onChange={(v) => onNameChange(element, v)}
                          verifyLayerNameUniqueness={verifyLayerNameUniqueness ?? undefined}
                        />
                        <div className={style.textWrapper}>&nbsp; {getLayerInfo(element)}</div>

                        {showActions(element) && (
                          <>
                            {onDuplicate ? (
                              <IconButton
                                name="copy"
                                title={'Duplicate'}
                                ariaLabel={'Duplicate button'}
                                className={style.actionIcon}
                                onClick={() => onDuplicate(element)}
                              />
                            ) : null}

                            <IconButton
                              name="trash-alt"
                              title={'remove'}
                              ariaLabel={'Remove button'}
                              className={cx(style.actionIcon, style.dragIcon)}
                              onClick={() => onDelete(element)}
                            />
                          </>
                        )}
                        {layers.length > shouldRenderDragIconLengthThreshold && (
                          <Icon
                            aria-label="Drag and drop icon"
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

LayerDragDropList.defaultProps = {
  isGroup: () => false,
};

const styles = stylesFactory((theme: GrafanaTheme) => ({
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
