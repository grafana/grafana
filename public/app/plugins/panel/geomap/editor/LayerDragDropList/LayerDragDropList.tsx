import React from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import { css, cx } from '@emotion/css';
import { Icon, IconButton, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { config } from '@grafana/runtime';

type LayerDragDropListProps = {
  layers: any[];
  onDragEnd: (result: DropResult) => void;
  selection?: Number[];
};

export const LayerDragDropList = ({ layers, onDragEnd, selection }: LayerDragDropListProps) => {
  const style = styles(config.theme);

  const getRowStyle = (isSelected: boolean) => {
    return isSelected ? `${style.row} ${style.sel}` : style.row;
  };

  console.log(layers.length, layers, 'hmm');

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
                const uid = element.options.name;
                rows.push(
                  <Draggable key={uid} draggableId={uid} index={rows.length}>
                    {(provided, snapshot) => (
                      <div
                        className={getRowStyle(selection ? selection.includes(i) : false)}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        // onMouseDown={() => actions!.selectLayer(uid)}
                      >
                        {/* <LayerHeader layer={element.options} canRename={true} onChange={element.onChange} /> */}
                        <div className={style.textWrapper}>&nbsp; {element.options.type}</div>

                        <IconButton
                          name="trash-alt"
                          title={'remove'}
                          className={cx(style.actionIcon, style.dragIcon)}
                          // onClick={() => actions.deleteLayer(uid)}
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
