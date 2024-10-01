import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';

import { LayerName } from './LayerName';
import { LayerElement } from './types';

export const DATA_TEST_ID = 'layer-drag-drop-list';

export type LayerDragDropListProps<T extends LayerElement> = {
  layers: T[];
  getLayerInfo: (element: T) => string;
  onDragEnd: (result: DropResult) => void;
  onSelect: (element: T) => void;
  onDelete: (element: T) => void;
  onDuplicate?: (element: T) => void;
  showActions: (element: T) => boolean;
  selection?: string[]; // list of unique ids (names)
  excludeBaseLayer?: boolean;
  onNameChange: (element: T, newName: string) => void;
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
  const style = useStyles2(getStyles);

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
                        role="button"
                        tabIndex={0}
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
                                tooltip="Duplicate"
                                className={style.actionIcon}
                                onClick={() => onDuplicate(element)}
                              />
                            ) : null}

                            <IconButton
                              name="trash-alt"
                              tooltip="Remove"
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

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginBottom: theme.spacing(2),
  }),
  row: css({
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    minHeight: theme.spacing(4),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '3px',
    cursor: 'pointer',

    border: `1px solid ${theme.components.input.borderColor}`,
    '&:hover': {
      border: `1px solid ${theme.components.input.borderHover}`,
    },
  }),
  sel: css({
    border: `1px solid ${theme.colors.primary.border}`,
    '&:hover': {
      border: `1px solid ${theme.colors.primary.border}`,
    },
  }),
  dragIcon: css({
    cursor: 'drag',
  }),
  actionIcon: css({
    color: theme.colors.text.secondary,
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  typeWrapper: css({
    color: theme.colors.primary.text,
    marginRight: '5px',
  }),
  textWrapper: css({
    display: 'flex',
    alignItems: 'center',
    flexGrow: 1,
    overflow: 'hidden',
    marginRight: theme.spacing(1),
  }),
});
