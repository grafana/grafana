import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

import { DataTransformerConfig, GrafanaTheme2 } from '@grafana/data';
import { SceneDataQuery } from '@grafana/scenes';
import { ScrollContainer, Stack, useStyles2 } from '@grafana/ui';
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
  items: QueryTransformItem[];
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
}

export const QueryTransformList = memo(
  ({
    items,
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
  }: QueryTransformListProps) => {
    const styles = useStyles2(getStyles);

    const allConnections = useMemo(() => {
      const conns: Array<{ from: string; to: string }> = [];

      items.forEach((item) => {
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
    }, [items]);

    // Filter connections to only show for selected card
    const visibleConnections = useMemo(() => {
      if (!selectedId) {
        return [];
      }

      // Find the item to get its refId
      const activeItem = items.find((item) => item.id === selectedId);
      if (!activeItem || !('refId' in activeItem.data)) {
        return [];
      }

      const activeRefId = activeItem.data.refId;

      // Show connections where this card is involved (either as source or destination)
      return allConnections.filter((conn) => conn.from === activeRefId || conn.to === activeRefId);
    }, [allConnections, selectedId, items]);

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
            onToggleVisibility: undefined,
          };
      }
    };

    return (
      <div className={styles.container}>
        <ConnectionLines connections={visibleConnections} />
        <ScrollContainer data-scrollcontainer>
          <div className={styles.content}>
            <Stack direction="column" gap={2}>
              {items.map((item) => (
                <QueryTransformCard
                  key={item.id}
                  item={item.data}
                  type={item.type}
                  index={item.index}
                  isSelected={selectedId === item.id}
                  onClick={() => onSelect(item.id)}
                  {...getHandlers(item)}
                />
              ))}

              <AddDataItemMenu
                onAddQuery={onAddQuery}
                onAddTransform={onAddTransform}
                onAddExpression={onAddExpression}
              />
            </Stack>
          </div>
        </ScrollContainer>
      </div>
    );
  }
);

QueryTransformList.displayName = 'QueryTransformList';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    }),
    content: css({
      position: 'relative',
      padding: theme.spacing(2),
      paddingRight: theme.spacing(6), // Extra space for the connection line
      zIndex: 1,
    }),
  };
};
