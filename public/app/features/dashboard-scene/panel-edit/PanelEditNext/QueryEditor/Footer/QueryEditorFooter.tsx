import { css, cx } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

export interface FooterLabelValue {
  id: string;
  label: string;
  value: string;
  isActive?: boolean;
}

interface QueryEditorFooterProps {
  items: FooterLabelValue[];
  onItemClick: (item: FooterLabelValue) => void;
  onToggleSidebar: () => void;
}

export function QueryEditorFooter({ items, onItemClick, onToggleSidebar }: QueryEditorFooterProps) {
  const styles = useStyles2(getStyles);

  const handleItemClick = useCallback(
    (item: FooterLabelValue) => {
      onItemClick(item);
    },
    [onItemClick]
  );

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <ul className={styles.itemsList}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <button
                type="button"
                className={cx(styles.itemButton, item.isActive && styles.itemButtonActive)}
                onClick={() => handleItemClick(item)}
                aria-label={t('query-editor.footer.edit-option', 'Edit {{label}}', { label: item.label })}
              >
                {item.isActive && <span className={styles.activeIndicator} />}
                <span className={styles.label}>{item.label}</span>
                <span className={cx(styles.value, item.isActive && styles.valueActive)}>{item.value}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={styles.queryOptionsButton}
          onClick={onToggleSidebar}
          aria-label={t('query-editor.footer.query-options', 'Query Options')}
        >
          <Trans i18nKey="query-editor.footer.query-options">Query Options</Trans>
          <Icon name="angle-left" size="md" />
        </button>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.background.secondary,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderBottomLeftRadius: theme.shape.radius.default,
      borderBottomRightRadius: theme.shape.radius.default,
      padding: theme.spacing(0.5, 1.5),
      zIndex: 1,
      minHeight: 26,
    }),
    content: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
    }),
    itemsList: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      listStyle: 'none',
      margin: 0,
      padding: 0,
      flexWrap: 'wrap',
      flex: 1,
    }),
    item: css({
      display: 'flex',
      alignItems: 'center',
    }),
    itemButton: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        opacity: 0.8,
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: 2,
      },
    }),
    itemButtonActive: css({
      // Additional styles for active state if needed
    }),
    label: css({
      color: theme.colors.text.primary,
    }),
    value: css({
      color: theme.colors.text.secondary,
    }),
    valueActive: css({
      color: theme.colors.success.text,
    }),
    activeIndicator: css({
      width: 6,
      height: 6,
      borderRadius: theme.shape.radius.circle,
      backgroundColor: theme.colors.success.text,
      flexShrink: 0,
    }),
    queryOptionsButton: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      color: theme.colors.primary.text,
      fontSize: theme.typography.bodySmall.fontSize,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        opacity: 0.8,
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: 2,
      },
    }),
  };
}
