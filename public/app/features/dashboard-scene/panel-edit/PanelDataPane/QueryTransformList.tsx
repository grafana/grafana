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

    // Detect connections between items
    const connections = useMemo(() => {
      const conns: Array<{ from: string; to: string }> = [];

      items.forEach((item) => {
        if (item.type === 'expression' && 'expression' in item.data && 'refId' in item.data) {
          const expr = item.data;

          if ('expression' in expr && typeof expr.expression === 'string' && 'type' in expr) {
            const expressionType = expr.type;
            const expressionString = expr.expression;

            if (expressionType === 'math') {
              // Math expressions: parse $A, $B, etc.
              const matches = expressionString.matchAll(/\$(\w+)/g);
              for (const match of matches) {
                const refId = match[1];
                conns.push({ from: refId, to: expr.refId });
              }
            } else if (expressionType === 'reduce' || expressionType === 'resample' || expressionType === 'threshold') {
              // Reduce/Resample/Threshold: expression field is a single refId
              if (expressionString) {
                conns.push({ from: expressionString, to: expr.refId });
              }
            }
            // TODO: Handle 'sql' and 'classic_conditions' types if needed
          }
        }
      });

      console.log('Detected connections:', conns);

      return conns;
    }, [items]);

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

    // Calculate number of lanes for dynamic padding
    const lanesByExpression = useMemo(() => {
      const lanes = new Map<string, Set<string>>();
      connections.forEach((conn) => {
        if (!lanes.has(conn.to)) {
          lanes.set(conn.to, new Set());
        }
      });
      return lanes.size;
    }, [connections]);

    return (
      <div className={styles.container}>
        <ConnectionLines connections={connections} />
        <ScrollContainer data-scrollcontainer>
          <div className={lanesByExpression > 0 ? styles.contentWithConnections(lanesByExpression) : styles.content}>
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
  const laneSpacing = 16; // Must match ConnectionLines.tsx
  const baseOffset = 24; // Must match ConnectionLines.tsx
  const extraPadding = 8; // Extra breathing room beyond the last lane

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
      zIndex: 1,
    }),
    contentWithConnections: (numLanes: number) =>
      css({
        position: 'relative',
        padding: theme.spacing(2),
        // Calculate exact space needed: base offset + (lanes * spacing) + extra padding
        paddingRight: baseOffset + numLanes * laneSpacing + extraPadding,
        zIndex: 1,
      }),
  };
};
