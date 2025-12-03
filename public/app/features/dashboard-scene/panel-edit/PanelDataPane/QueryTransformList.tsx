import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { memo, useMemo, useState } from 'react';

import { DataTransformerConfig, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneDataQuery } from '@grafana/scenes';
import { Icon, ScrollContainer, Stack, useStyles2 } from '@grafana/ui';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { AddDataItemMenu } from './AddDataItemMenu';
import { ConnectionLines } from './ConnectionLines';
import { QueryTransformCard } from './QueryTransformCard';

export interface QueryTransformItem {
  id: string;
  type: 'query' | 'transform' | 'expression';
  data: SceneDataQuery | DataTransformerConfig;
  index: number;
}

interface QueryTransformListProps {
  allItems: QueryTransformItem[];
  dataSourceItems: QueryTransformItem[];
  transformItems: QueryTransformItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddQuery: () => void;
  onAddTransform: () => void;
  onAddExpression: (type: ExpressionQueryType) => void;
  onDuplicateQuery?: (index: number) => void;
  onRemoveQuery?: (index: number) => void;
  onToggleQueryVisibility?: (index: number) => void;
  onDuplicateExpression?: (index: number) => void;
  onRemoveExpression?: (index: number) => void;
  onToggleExpressionVisibility?: (index: number) => void;
  onRemoveTransform?: (index: number) => void;
  onToggleTransformVisibility?: (index: number) => void;
  onReorderDataSources?: (startIndex: number, endIndex: number) => void;
  onReorderTransforms?: (startIndex: number, endIndex: number) => void;
}

export const QueryTransformList = memo(
  ({
    dataSourceItems,
    transformItems,
    allItems,
    selectedId,
    onSelect,
    onAddQuery,
    onAddTransform,
    onAddExpression,
    onDuplicateQuery,
    onRemoveQuery,
    onToggleQueryVisibility,
    onDuplicateExpression,
    onRemoveExpression,
    onToggleExpressionVisibility,
    onRemoveTransform,
    onToggleTransformVisibility,
    onReorderDataSources,
    onReorderTransforms,
  }: QueryTransformListProps) => {
    const styles = useStyles2(getStyles);
    const [isDragging, setIsDragging] = useState(false);

    const onDragStart = () => {
      setIsDragging(true);
    };

    const onDragEnd = (result: DropResult) => {
      // Defer state updates until after drop animation
      setTimeout(() => {
        setIsDragging(false);

        if (!result.destination) {
          return;
        }

        const startIndex = result.source.index;
        const endIndex = result.destination.index;

        if (startIndex === endIndex) {
          return;
        }

        // Handle reordering based on droppable ID
        if (result.source.droppableId === 'data-sources' && result.destination.droppableId === 'data-sources') {
          onReorderDataSources?.(startIndex, endIndex);
        } else if (
          result.source.droppableId === 'transformations' &&
          result.destination.droppableId === 'transformations'
        ) {
          onReorderTransforms?.(startIndex, endIndex);
        }
      }, 0);
    };

    const allConnections = useMemo(() => {
      const conns: Array<{ from: string; to: string }> = [];

      allItems.forEach((item) => {
        if (item.type === 'expression' && 'expression' in item.data && 'refId' in item.data) {
          const expr = item.data;

          if ('expression' in expr && typeof expr.expression === 'string' && 'type' in expr) {
            const expressionType = expr.type;
            const expressionString = expr.expression;

            if (expressionType === 'math') {
              const matches = expressionString.matchAll(/\$(\w+)/g);
              for (const match of matches) {
                conns.push({ from: match[1], to: expr.refId });
              }
            } else if (expressionType === 'reduce' || expressionType === 'resample' || expressionType === 'threshold') {
              if (expressionString) {
                conns.push({ from: expressionString, to: expr.refId });
              }
            }
          }
        }
      });

      return conns;
    }, [allItems]);

    // Filter connections to only show for selected card
    const visibleConnections = useMemo(() => {
      if (!selectedId) {
        return [];
      }

      // Find the item to get its refId
      const activeItem = allItems.find((item) => item.id === selectedId);
      if (!activeItem || !('refId' in activeItem.data)) {
        return [];
      }

      const activeRefId = activeItem.data.refId;

      // Show connections where this card is involved (either as source or destination)
      return allConnections.filter((conn) => conn.from === activeRefId || conn.to === activeRefId);
    }, [allConnections, selectedId, allItems]);

    const getHandlers = (item: QueryTransformItem) => {
      switch (item.type) {
        case 'query':
          return {
            onDuplicate: onDuplicateQuery ? () => onDuplicateQuery(item.index) : undefined,
            onRemove: onRemoveQuery ? () => onRemoveQuery(item.index) : undefined,
            onToggleVisibility: onToggleQueryVisibility ? () => onToggleQueryVisibility(item.index) : undefined,
          };
        case 'expression':
          return {
            onDuplicate: onDuplicateExpression ? () => onDuplicateExpression(item.index) : undefined,
            onRemove: onRemoveExpression ? () => onRemoveExpression(item.index) : undefined,
            onToggleVisibility: onToggleExpressionVisibility
              ? () => onToggleExpressionVisibility(item.index)
              : undefined,
          };
        case 'transform':
          return {
            onDuplicate: undefined,
            onRemove: onRemoveTransform ? () => onRemoveTransform(item.index) : undefined,
            onToggleVisibility: onToggleTransformVisibility ? () => onToggleTransformVisibility(item.index) : undefined,
          };
      }
    };

    const stats = useMemo(() => {
      const totalCards = allItems.length;
      const hiddenQueries = dataSourceItems.filter((item) => 'hide' in item.data && item.data.hide);
      const disabledTransforms = transformItems.filter((item) => 'disabled' in item.data && item.data.disabled);
      const hiddenTotal = hiddenQueries.length + disabledTransforms.length;
      const visibleTotal = totalCards - hiddenTotal;

      return {
        totalCards,
        visibleQueries: visibleTotal,
        hiddenQueries: hiddenTotal,
      };
    }, [allItems, dataSourceItems, transformItems]);

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Stack justifyContent="space-between" alignItems="center" gap={2}>
            <span className={styles.headerTitle}>
              {t('dashboard-scene.query-transform-list.header', 'Pipeline flow')}
            </span>
          </Stack>
        </div>
        <div className={styles.scrollWrapper}>
          <ScrollContainer data-scrollcontainer>
            <div className={styles.contentWrapper}>
              <ConnectionLines connections={visibleConnections} isDragging={isDragging} />
              <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <div className={styles.content}>
                  <Stack direction="column" gap={3}>
                    {/* Data Sources Section (Queries + Expressions) */}
                    {dataSourceItems.length > 0 && (
                      <Stack direction="column" gap={2}>
                        <div className={styles.sectionLabel}>
                          {t('dashboard-scene.query-transform-list.queries-expressions', 'Queries & Expressions')}
                        </div>
                        <Droppable droppableId="data-sources">
                          {(provided, snapshot) => {
                            // Check if dragging from transformations section
                            const isDraggingFromOtherSection =
                              isDragging && snapshot.draggingFromThisWith === null && snapshot.isDraggingOver;

                            return (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={isDraggingFromOtherSection ? styles.droppableInvalid : undefined}
                              >
                                <Stack direction="column" gap={2}>
                                  {dataSourceItems.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={snapshot.isDragging ? styles.dragging : undefined}
                                        >
                                          <QueryTransformCard
                                            item={item.data}
                                            type={item.type}
                                            index={item.index}
                                            isSelected={selectedId === item.id}
                                            onClick={() => onSelect(item.id)}
                                            {...getHandlers(item)}
                                          />
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </Stack>
                              </div>
                            );
                          }}
                        </Droppable>
                      </Stack>
                    )}

                    {/* Transformations Section */}
                    {transformItems.length > 0 && (
                      <Stack direction="column" gap={2}>
                        <div className={styles.sectionLabel}>
                          {t('dashboard-scene.query-transform-list.transformations', 'Transformations')}
                        </div>
                        <Droppable droppableId="transformations">
                          {(provided, snapshot) => {
                            // Check if dragging from data sources section
                            const isDraggingFromOtherSection =
                              isDragging && snapshot.draggingFromThisWith === null && snapshot.isDraggingOver;

                            return (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={isDraggingFromOtherSection ? styles.droppableInvalid : undefined}
                              >
                                <Stack direction="column" gap={2}>
                                  {transformItems.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={snapshot.isDragging ? styles.dragging : undefined}
                                        >
                                          <QueryTransformCard
                                            item={item.data}
                                            type={item.type}
                                            index={item.index}
                                            isSelected={selectedId === item.id}
                                            onClick={() => onSelect(item.id)}
                                            {...getHandlers(item)}
                                          />
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </Stack>
                              </div>
                            );
                          }}
                        </Droppable>
                      </Stack>
                    )}

                    <AddDataItemMenu
                      onAddQuery={onAddQuery}
                      onAddTransform={onAddTransform}
                      onAddExpression={onAddExpression}
                    />
                  </Stack>
                </div>
              </DragDropContext>
            </div>
          </ScrollContainer>
        </div>
        <div className={styles.footer}>
          <Stack direction="row" gap={1.5}>
            <span className={styles.footerStat}>
              {stats.totalCards} {t('dashboard-scene.query-transform-list.nodes', 'nodes')}
            </span>
            <span className={styles.footerStat}>
              <Icon size="xs" name="eye" />
              {stats.visibleQueries}
            </span>
            <span className={styles.footerStat}>
              <Icon size="xs" name="eye-slash" />
              {stats.hiddenQueries}
            </span>
          </Stack>
        </div>
      </div>
    );
  }
);

QueryTransformList.displayName = 'QueryTransformList';

const getStyles = (theme: GrafanaTheme2) => {
  const headerHeight = 41;
  const footerHeight = 32;
  const barBase = {
    padding: theme.spacing(0.5, 2),
    background: theme.colors.background.secondary,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  };

  return {
    container: css({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    header: css({
      ...barBase,
      height: headerHeight,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerTitle: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      textTransform: 'uppercase',
      color: theme.colors.text.primary,
    }),
    sectionLabel: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.maxContrast,
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginLeft: theme.spacing(-2),
      marginRight: theme.spacing(-2),
      '&::after': {
        content: '""',
        flex: 1,
        height: '1px',
        background: theme.colors.border.weak,
      },
    }),
    scrollWrapper: css({
      flex: 1,
      minHeight: 0,
    }),
    contentWrapper: css({
      position: 'relative',
      minHeight: '100%',
    }),
    content: css({
      padding: `${theme.spacing(2)} ${theme.spacing(8)} ${theme.spacing(4)} ${theme.spacing(6)}`,
      position: 'relative',
    }),
    dragging: css({
      opacity: 0.8,
      cursor: 'grabbing !important',
      // Use GPU-accelerated properties only
      willChange: 'transform',
    }),
    droppableActive: css({
      // Minimal styling for performance
    }),
    droppableInvalid: css({
      position: 'relative',
      cursor: 'not-allowed',
      '&::after': {
        content: '""',
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        background: theme.colors.error.transparent,
        borderRadius: theme.shape.radius.default,
        pointerEvents: 'none',
        zIndex: 0,
      },
      '& > *': {
        position: 'relative',
        zIndex: 1,
      },
    }),
    footer: css({
      ...barBase,
      height: footerHeight,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      gap: theme.spacing(1),
      position: 'relative',
      zIndex: 20,
    }),
    footerStat: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
  };
};
