import { css } from '@emotion/css';
import clsx from 'clsx';
import { memo, useMemo } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { getExpressionIcon } from 'app/features/expressions/types';

import { usePanelDataPaneColors } from './theme';
import { QueryTransformItem } from './types';

interface QueryTransformCardProps {
  item: QueryTransformItem;
  isSelected: boolean;
  onClick: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  onToggleVisibility?: () => void;
  debugHiddenOverride?: boolean | null;
}

export const QueryTransformCard = memo(
  ({
    item: { data, type, id: itemId, index },
    isSelected,
    onClick,
    onDuplicate,
    onRemove,
    onToggleVisibility,
    debugHiddenOverride,
  }: QueryTransformCardProps) => {
    const colors = usePanelDataPaneColors();
    const styles = useStyles2(getStyles, colors);

    const datasourceIcon = useMemo(() => {
      if (type === 'query' && 'datasource' in data && data.datasource) {
        try {
          const dsSettings = getDataSourceSrv().getInstanceSettings(data.datasource);
          return dsSettings?.meta.info.logos.small;
        } catch {
          return undefined;
        }
      }
      return undefined;
    }, [type, data]);

    // Compute effective visibility: use debug override if present, otherwise use actual state
    const actualHidden =
      ((type === 'query' || type === 'expression') && 'hide' in data && data.hide) ||
      (type === 'transform' && 'disabled' in data && data.disabled);

    const isHidden =
      debugHiddenOverride !== null && debugHiddenOverride !== undefined ? debugHiddenOverride : actualHidden;

    const typeLabel = useMemo(() => {
      switch (type) {
        case 'query':
          return t('dashboard-scene.query-transform-card.query.label', 'Query');
        case 'expression':
          return t('dashboard-scene.query-transform-card.expression.label', 'Expression');
        case 'transform':
          return t('dashboard-scene.query-transform-card.transform.label', 'Transform');
        default:
          throw new Error('unreachable');
      }
    }, [type]);

    const name = useMemo(() => {
      switch (type) {
        case 'query':
        case 'expression': {
          // FIXME untranslated string
          return data.refId || `${type === 'expression' ? 'Expression' : 'Query'} ${index + 1}`;
        }
        case 'transform':
          return data.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        default:
          throw new Error('unreachable');
      }
    }, [type, data, index]);

    const icon = useMemo((): IconName => {
      switch (type) {
        case 'query':
          return 'database';
        case 'expression': {
          const type = isExpressionQuery(data) ? data.type : undefined;
          return getExpressionIcon(type);
        }
        case 'transform':
          return 'pivot';
        default:
          throw new Error('unreachable');
      }
    }, [data, type]);

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
        className={clsx(styles.card, { [styles.cardSelected]: isSelected, [styles.cardHidden]: isHidden })}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        data-testid={`${type}-card-${index}`}
        data-card-id={itemId}
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
          <div className={styles.headerActions}>
            <div className={clsx(styles.quickActions, styles.quickActionsClass)}>
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
            </div>
            {onToggleVisibility && (
              <div
                className={clsx(styles.eyeIconWrapper, !isHidden && [styles.eyeIconHidden, styles.eyeIconHiddenClass])}
              >
                <IconButton
                  name={isHidden ? 'eye-slash' : 'eye'}
                  size="sm"
                  variant="secondary"
                  tooltip={
                    isHidden
                      ? type === 'transform'
                        ? t('dashboard-scene.query-transform-card.enable-transform', 'Enable transformation')
                        : t('dashboard-scene.query-transform-card.show-response', 'Show response')
                      : type === 'transform'
                        ? t('dashboard-scene.query-transform-card.disable-transform', 'Disable transformation')
                        : t('dashboard-scene.query-transform-card.hide-response', 'Hide response')
                  }
                  onClick={(e) => handleAction(e, onToggleVisibility)}
                  className={styles.actionButton}
                />
              </div>
            )}
          </div>
        </div>

        {/* Content: Name */}
        <div className={styles.content}>
          <Stack direction="row" alignItems="center" gap={1}>
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

const getStyles = (theme: GrafanaTheme2, colors: ReturnType<typeof usePanelDataPaneColors>) => {
  const selectedClass = 'card-selected';
  const hiddenClass = 'card-hidden';
  const hoverOnlyClass = 'hover-only';

  return {
    card: css({
      position: 'relative',
      cursor: 'pointer',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      background: theme.colors.background.secondary,
      width: '100%',
      minWidth: 180,
      maxWidth: 300,
      '&:hover': {
        borderColor: theme.colors.border.strong,
        [`.${hoverOnlyClass}`]: {
          opacity: 1,
        },
      },
      [`&.${selectedClass}`]: {
        borderColor: theme.colors.primary.border,
        boxShadow: `0 0 0 1px ${theme.colors.primary.border}`,
      },
      [`&.${selectedClass}:hover`]: {
        borderColor: theme.colors.primary.border,
        boxShadow: `0 0 0 1px ${theme.colors.primary.border}`,
      },
      [`&.${hiddenClass}`]: {
        opacity: 0.5,
      },
    }),
    cardSelected: selectedClass,
    cardHidden: hiddenClass,
    headerQuery: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0.5),
      background: theme.colors.background.canvas,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      color: colors.query.accent,
    }),
    headerTransform: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0.5),
      background: theme.colors.background.canvas,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      color: colors.transform.accent,
    }),
    headerExpression: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0.5),
      background: theme.colors.background.canvas,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      color: colors.expression.accent,
    }),
    headerLeft: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      flex: 1,
      minWidth: 0,
    }),
    headerIcon: css({
      color: 'inherit',
      flexShrink: 0,
    }),
    typeLabel: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: 'inherit',
      textTransform: 'uppercase',
    }),
    headerActions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
    }),
    quickActions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      opacity: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 0.2s ease',
      },
    }),
    quickActionsClass: hoverOnlyClass,
    eyeIconWrapper: css({
      display: 'flex',
      alignItems: 'center',
    }),
    eyeIconHidden: css({
      opacity: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 0.2s ease',
      },
    }),
    eyeIconHiddenClass: hoverOnlyClass,
    actionButton: css({
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    content: css({
      padding: theme.spacing(0.75) + ' ' + theme.spacing(1),
    }),
    datasourceIcon: css({
      width: '16px',
      height: '16px',
      flexShrink: 0,
    }),
    name: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.maxContrast,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
};
