import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

import { DataTransformerConfig, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneDataQuery } from '@grafana/scenes';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

interface QueryTransformCardProps {
  item: SceneDataQuery | DataTransformerConfig;
  type: 'query' | 'transform' | 'expression';
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
      if ((type === 'query' || type === 'expression') && 'refId' in item) {
        return item.refId || `${type === 'expression' ? 'Expression' : 'Query'} ${index + 1}`;
      } else if ('id' in item) {
        return item.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      }
      return '';
    };

    const datasourceIcon = useMemo(() => {
      if (type === 'query' && 'datasource' in item && item.datasource) {
        try {
          const dsSettings = getDataSourceSrv().getInstanceSettings(item.datasource);
          return dsSettings?.meta.info.logos.small;
        } catch {
          return undefined;
        }
      }
      return undefined;
    }, [type, item]);

    const isHidden = (type === 'query' || type === 'expression') && 'hide' in item && item.hide;
    const icon = type === 'query' ? 'database' : type === 'expression' ? 'calculator-alt' : 'process';
    const typeLabel = type === 'query' ? 'Query' : type === 'expression' ? 'Expression' : 'Transformation';
    const name = getName();

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
        <div
          className={
            type === 'query'
              ? styles.headerQuery
              : type === 'expression'
                ? styles.headerExpression
                : styles.headerTransform
          }
        >
          <div className={styles.headerLeft}>
            <Icon name={icon} className={styles.headerIcon} />
            <span className={styles.typeLabel}>{typeLabel}</span>
          </div>
          <div className={`${styles.actions} ${styles.actionsClass}`}>
            <Stack gap={0.5}>
              {(type === 'query' || type === 'expression') && onToggleVisibility && (
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
              {(type === 'query' || type === 'expression') && onDuplicate && (
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

        {/* Content: Name */}
        <div className={styles.content}>
          <Stack direction="row" gap={1}>
            {type === 'query' && datasourceIcon && (
              <img src={datasourceIcon} alt="" className={styles.datasourceIcon} />
            )}
            <div className={styles.name}>{name}</div>
          </Stack>
        </div>
      </div>
    );
  }
);

QueryTransformCard.displayName = 'QueryTransformCard';

const getStyles = (theme: GrafanaTheme2) => {
  const actionsClass = 'actions-container';
  const selectedClass = 'card-selected';

  return {
    card: css({
      cursor: 'pointer',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      background: theme.colors.background.primary,
      width: '100%',
      [`&:hover .${actionsClass}`]: {
        opacity: 1,
      },
      '&:hover': {
        borderColor: theme.colors.border.strong,
      },
      [`&.${selectedClass}`]: {
        borderColor: theme.colors.primary.border,
        boxShadow: `0 0 0 1px ${theme.colors.primary.border}`,
      },
      [`&.${selectedClass}:hover`]: {
        borderColor: theme.colors.primary.border,
        boxShadow: `0 0 0 1px ${theme.colors.primary.border}`,
      },
    }),
    cardSelected: selectedClass,
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
    headerExpression: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 1.5),
      background: theme.isDark
        ? `${theme.visualization.getColorByName('purple')}20`
        : `${theme.visualization.getColorByName('purple')}15`,
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
      fontFamily: "'CommitMono', monospace",
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
    datasourceIcon: css({
      width: '16px',
      height: '16px',
      flexShrink: 0,
    }),
    name: css({
      fontFamily: "'CommitMono', monospace",
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),
  };
};
