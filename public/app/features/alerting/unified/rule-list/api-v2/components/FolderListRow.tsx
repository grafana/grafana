import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

interface Props {
  title: string;
  firingCount: number;
  groupCount: number;
  active: boolean;
  onSelect: () => void;
  rowId: string;
  tabIndex: number;
}

export function FolderListRow({ title, firingCount, groupCount, active, onSelect, rowId, tabIndex }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div
      id={rowId}
      role="treeitem"
      aria-selected={active}
      tabIndex={tabIndex}
      className={cx(styles.row, active && styles.active)}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <Icon name={active ? 'folder-open' : 'folder'} className={styles.icon} aria-hidden="true" />
      <span className={styles.title} title={title}>
        {title}
      </span>
      {firingCount > 0 && <span className={styles.firing}>{firingCount}</span>}
      <span className={styles.group}>{groupCount}</span>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      padding: theme.spacing(0.5, 1),
      cursor: 'pointer',
      borderLeft: '2px solid transparent',
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        background: theme.colors.action.hover,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: -2,
      },
    }),
    active: css({
      background: theme.colors.background.secondary,
      borderLeftColor: theme.colors.primary.main,
    }),
    icon: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
    title: css({
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    firing: css({
      color: theme.colors.error.text,
      fontVariantNumeric: 'tabular-nums',
      fontFamily: theme.typography.fontFamilyMonospace,
      minWidth: theme.spacing(2),
      textAlign: 'right',
    }),
    group: css({
      color: theme.colors.text.secondary,
      fontVariantNumeric: 'tabular-nums',
      fontFamily: theme.typography.fontFamilyMonospace,
      minWidth: theme.spacing(2),
      textAlign: 'right',
    }),
  };
}
