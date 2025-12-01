import { css } from '@emotion/css';
import { memo } from 'react';

import { DataTransformerConfig, GrafanaTheme2 } from '@grafana/data';
import { SceneDataQuery } from '@grafana/scenes';
import { ScrollContainer, Stack, useStyles2 } from '@grafana/ui';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { AddDataItemMenu } from './AddDataItemMenu';
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
        <div className={styles.scrollContainer}>
          <ScrollContainer>
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
          </ScrollContainer>
        </div>
      </div>
    );
  }
);

QueryTransformList.displayName = 'QueryTransformList';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    }),
    scrollContainer: css({
      padding: theme.spacing(2),
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
    }),
  };
};
