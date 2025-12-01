import { css } from '@emotion/css';
import { memo } from 'react';

import { DataTransformerConfig, GrafanaTheme2 } from '@grafana/data';
import { SceneDataQuery } from '@grafana/scenes';
import { ScrollContainer, useStyles2 } from '@grafana/ui';
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

    const queries = items.filter((item) => item.type === 'query');
    const expressions = items.filter((item) => item.type === 'expression');
    const transforms = items.filter((item) => item.type === 'transform');

    return (
      <div className={styles.container}>
        <div className={styles.scrollContainer}>
          <ScrollContainer>
            <div className={styles.content}>
              {queries.length > 0 && (
                <div className={styles.section}>
                  {queries.map((item) => (
                    <QueryTransformCard
                      key={item.id}
                      item={item.data}
                      type="query"
                      index={item.index}
                      isSelected={selectedId === item.id}
                      onClick={() => onSelect(item.id)}
                      onDuplicate={onDuplicateQuery ? () => onDuplicateQuery(item.index) : undefined}
                      onRemove={onRemoveQuery ? () => onRemoveQuery(item.index) : undefined}
                      onToggleVisibility={
                        onToggleQueryVisibility ? () => onToggleQueryVisibility(item.index) : undefined
                      }
                    />
                  ))}
                </div>
              )}

              {expressions.length > 0 && (
                <div className={styles.section}>
                  {expressions.map((item) => (
                    <QueryTransformCard
                      key={item.id}
                      item={item.data}
                      type="expression"
                      index={item.index}
                      isSelected={selectedId === item.id}
                      onClick={() => onSelect(item.id)}
                      onDuplicate={onDuplicateExpression ? () => onDuplicateExpression(item.index) : undefined}
                      onRemove={onRemoveExpression ? () => onRemoveExpression(item.index) : undefined}
                      onToggleVisibility={
                        onToggleExpressionVisibility ? () => onToggleExpressionVisibility(item.index) : undefined
                      }
                    />
                  ))}
                </div>
              )}

              {transforms.length > 0 && (
                <div className={styles.section}>
                  {transforms.map((item) => (
                    <QueryTransformCard
                      key={item.id}
                      item={item.data}
                      type="transform"
                      index={item.index}
                      isSelected={selectedId === item.id}
                      onClick={() => onSelect(item.id)}
                      onRemove={onRemoveTransform ? () => onRemoveTransform(item.index) : undefined}
                    />
                  ))}
                </div>
              )}

              <div className={styles.addButton}>
                <AddDataItemMenu
                  onAddQuery={onAddQuery}
                  onAddTransform={onAddTransform}
                  onAddExpression={onAddExpression}
                />
              </div>
            </div>
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
      background: theme.colors.background.primary,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      overflow: 'hidden',
    }),
    scrollContainer: css({
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
    }),
    content: css({
      padding: theme.spacing(2),
    }),
    section: css({
      '&:not(:first-child)': {
        marginTop: theme.spacing(2),
      },
    }),
    addButton: css({
      marginTop: theme.spacing(2),
      paddingTop: theme.spacing(2),
    }),
  };
};
