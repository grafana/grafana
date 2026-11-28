import { css } from '@emotion/css';
import { type Row, type UseExpandedRowProps } from 'react-table';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { type CallTreeNode } from './utils';

const INDENT = 16;

export function FunctionCellWithExpander({
  row,
  value,
  depth,
  hasChildren,
  onClick,
  compact = false,
}: {
  row: Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>;
  value: string;
  depth: number;
  hasChildren: boolean;
  onClick: (row: Row<CallTreeNode>) => void;
  compact?: boolean;
}) {
  const styles = useStyles2(getStyles);
  const prefixEnd = value.lastIndexOf('/') + 1;

  return (
    <div className={styles.container} style={{ paddingLeft: depth * INDENT }}>
      {depth > 0 && <span className={styles.guides} style={{ width: (depth - 1) * INDENT + 1 }} />}
      <button
        type="button"
        data-function-label
        className={styles.label}
        aria-expanded={hasChildren ? Boolean(row.isExpanded) : undefined}
        onClick={() => onClick(row)}
      >
        {hasChildren ? (
          <Icon name={row.isExpanded ? 'angle-down' : 'angle-right'} className={styles.chevron} />
        ) : (
          <span className={styles.chevron} />
        )}
        <span>
          {prefixEnd > 0 && <span className={styles.prefix}>{value.substring(0, prefixEnd)}</span>}
          {value.substring(prefixEnd)}
        </span>
      </button>
      {!compact && row.original.children && row.original.children.length > 0 && (
        <span className={styles.nodeBadge}>
          {row.original.children.length} {row.original.children.length === 1 ? 'child' : 'children'},{' '}
          {row.original.subtreeSize} {row.original.subtreeSize === 1 ? 'node' : 'nodes'}
        </span>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height: '24px',
      width: 'max-content',
    }),
    guides: css({
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: INDENT / 2,
      backgroundImage: `linear-gradient(to right, ${theme.colors.border.medium} 0 1px, transparent 1px)`,
      backgroundSize: `${INDENT}px 100%`,
    }),
    label: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: 0,
      border: 'none',
      background: 'none',
      color: theme.colors.text.primary,
      fontSize: theme.typography.fontSize,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
    }),
    chevron: css({
      flexShrink: 0,
      width: INDENT,
      color: theme.colors.text.secondary,
      'tr:hover &': {
        color: theme.colors.text.primary,
      },
    }),
    prefix: css({
      color: theme.colors.text.secondary,
    }),
    nodeBadge: css({
      marginLeft: theme.spacing(1),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.disabled,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }),
  };
}
