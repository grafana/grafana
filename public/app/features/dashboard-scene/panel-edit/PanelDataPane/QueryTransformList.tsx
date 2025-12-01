import { css } from '@emotion/css';
import { memo } from 'react';

import { DataTransformerConfig, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneDataQuery } from '@grafana/scenes';
import { Button, ScrollContainer, Stack, useStyles2 } from '@grafana/ui';

import { QueryTransformCard } from './QueryTransformCard';

export interface QueryTransformItem {
  id: string;
  type: 'query' | 'transform';
  data: SceneDataQuery | DataTransformerConfig;
  index: number;
}

interface QueryTransformListProps {
  items: QueryTransformItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddQuery: () => void;
  onAddTransform: () => void;
  onDuplicateQuery?: (index: number) => void;
  onRemoveQuery?: (index: number) => void;
  onToggleQueryVisibility?: (index: number) => void;
  onRemoveTransform?: (index: number) => void;
}

export const QueryTransformList = memo(
  ({
    items,
    selectedId,
    onSelect,
    onAddQuery,
    onAddTransform,
    onDuplicateQuery,
    onRemoveQuery,
    onToggleQueryVisibility,
    onRemoveTransform,
  }: QueryTransformListProps) => {
    const styles = useStyles2(getStyles);

    const queries = items.filter((item) => item.type === 'query');
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
            </div>
          </ScrollContainer>
        </div>

        <div className={styles.actions}>
          <Stack direction="column" gap={1}>
            <Button icon="plus" variant="secondary" onClick={onAddQuery} fullWidth>
              <Trans i18nKey="dashboard-scene.query-transform-list.add-query">Add query</Trans>
            </Button>
            <Button icon="plus" variant="secondary" onClick={onAddTransform} fullWidth>
              <Trans i18nKey="dashboard-scene.query-transform-list.add-transformation">Add transformation</Trans>
            </Button>
          </Stack>
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
    actions: css({
      padding: theme.spacing(2),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.canvas,
      flexShrink: 0,
    }),
  };
};
