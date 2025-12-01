import { css } from '@emotion/css';
import { memo } from 'react';

import { DataTransformerConfig, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneDataQuery } from '@grafana/scenes';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

interface QueryTransformCardProps {
  item: SceneDataQuery | DataTransformerConfig;
  type: 'query' | 'transform';
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  onToggleVisibility?: () => void;
}

export const QueryTransformCard = memo(
  ({ item, type, index, isSelected, onClick, onDuplicate, onRemove, onToggleVisibility }: QueryTransformCardProps) => {
    const styles = useStyles2(getStyles);

    const getName = (): string => {
      if (type === 'query' && 'refId' in item) {
        return item.refId || `Query ${index + 1}`;
      } else if ('id' in item) {
        return item.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      }
      return '';
    };

    const getDatasourceName = (): string => {
      if (type === 'query' && 'datasource' in item && item.datasource) {
        try {
          const dsSettings = getDataSourceSrv().getInstanceSettings(item.datasource);
          return dsSettings?.name || 'Unknown datasource';
        } catch {
          return 'Unknown datasource';
        }
      }
      return '';
    };

    const isHidden = type === 'query' && 'hide' in item && item.hide;
    const icon = type === 'query' ? 'database' : 'process';
    const typeLabel = type === 'query' ? 'Query' : 'Transformation';
    const name = getName();
    const datasourceName = getDatasourceName();

    const handleAction = (e: React.MouseEvent, action: () => void) => {
      e.stopPropagation();
      action();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    };

    return (
      <div
        role="button"
        tabIndex={0}
        className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        data-testid={`${type}-card-${index}`}
      >
        {/* Header with type and action icons */}
        <div className={type === 'query' ? styles.headerQuery : styles.headerTransform}>
          <div className={styles.headerLeft}>
            <Icon name={icon} className={styles.headerIcon} />
            <span className={styles.typeLabel}>{typeLabel}</span>
          </div>
          <div className={`${styles.actions} ${styles.actionsClass}`}>
            <Stack gap={0.5}>
              {type === 'query' && onToggleVisibility && (
                <IconButton
                  name={isHidden ? 'eye-slash' : 'eye'}
                  size="sm"
                  variant="secondary"
                  tooltip={
                    isHidden
                      ? t('dashboard-scene.query-transform-card.show-response', 'Show response')
                      : t('dashboard-scene.query-transform-card.hide-response', 'Hide response')
                  }
                  onClick={(e) => handleAction(e, onToggleVisibility)}
                  className={styles.actionButton}
                />
              )}
              {type === 'query' && onDuplicate && (
                <IconButton
                  name="copy"
                  size="sm"
                  variant="secondary"
                  tooltip={t('dashboard-scene.query-transform-card.duplicate', 'Duplicate query')}
                  onClick={(e) => handleAction(e, onDuplicate)}
                  className={styles.actionButton}
                />
              )}
              {onRemove && (
                <IconButton
                  name="trash-alt"
                  size="sm"
                  variant="secondary"
                  tooltip={
                    type === 'query'
                      ? t('dashboard-scene.query-transform-card.remove-query', 'Remove query')
                      : t('dashboard-scene.query-transform-card.remove-transform', 'Remove transformation')
                  }
                  onClick={(e) => handleAction(e, onRemove)}
                  className={styles.actionButton}
                />
              )}
            </Stack>
          </div>
        </div>

        {/* Content: Name and datasource */}
        <div className={styles.content}>
          <div className={styles.name}>{name}</div>
          {datasourceName && <div className={styles.datasource}>{datasourceName}</div>}
        </div>
      </div>
    );
  }
);

QueryTransformCard.displayName = 'QueryTransformCard';

const getStyles = (theme: GrafanaTheme2) => {
  const actionsClass = 'actions-container';

  return {
    card: css({
      cursor: 'pointer',
      marginBottom: theme.spacing(1),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      background: theme.colors.background.primary,
      [`&:hover .${actionsClass}`]: {
        opacity: 1,
      },
      '&:hover': {
        borderColor: theme.colors.border.strong,
      },
    }),
    cardSelected: css({
      borderColor: theme.colors.primary.border,
      boxShadow: `0 0 0 1px ${theme.colors.primary.border}`,
    }),
    headerQuery: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 1.5),
      background: theme.colors.primary.transparent,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerTransform: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 1.5),
      background: theme.isDark
        ? `${theme.visualization.getColorByName('orange')}20`
        : `${theme.visualization.getColorByName('orange')}15`,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerLeft: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flex: 1,
      minWidth: 0,
    }),
    headerIcon: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
    typeLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }),
    actions: css({
      opacity: 0,
      flexShrink: 0,
    }),
    actionsClass,
    actionButton: css({
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    content: css({
      padding: theme.spacing(1.5),
    }),
    name: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing(0.5),
    }),
    datasource: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
  };
};
