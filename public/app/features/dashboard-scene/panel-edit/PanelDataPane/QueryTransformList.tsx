import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

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

    const stats = useMemo(() => {
      const totalCards = items.length;
      const queries = items.filter((item) => item.type === 'query' || item.type === 'expression');
      const hiddenQueries = queries.filter((item) => 'hide' in item.data && item.data.hide);
      const visibleQueries = queries.length - hiddenQueries.length;

      return {
        totalCards,
        visibleQueries,
        hiddenQueries: hiddenQueries.length,
      };
    }, [items]);

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Stack justifyContent="space-between" alignItems="center" gap={2}>
            <span className={styles.headerTitle}>
              {t('dashboard-scene.query-transform-list.header', 'Pipeline flow')}
            </span>
          </Stack>
        </div>
        <ConnectionLines connections={visibleConnections} />
        <div className={styles.scrollWrapper}>
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
  const monoFont = "'CommitMono', monospace";
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
      overflow: 'hidden',
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    header: css({
      ...barBase,
      height: headerHeight,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerTitle: css({
      fontFamily: monoFont,
      textTransform: 'uppercase',
      color: theme.colors.text.primary,
    }),
    scrollWrapper: css({
      flex: 1,
      minHeight: 0,
      position: 'relative',
    }),
    content: css({
      padding: theme.spacing(2),
      paddingRight: theme.spacing(6),
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
      fontFamily: monoFont,
      fontSize: '10px',
      color: theme.colors.text.primary,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
  };
};
