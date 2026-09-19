import { css, cx } from '@emotion/css';
import { type Row, type UseExpandedRowProps } from 'react-table';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, useStyles2 } from '@grafana/ui';

import { type CallTreeNode } from './utils';

export function FunctionCellWithExpander({
  row,
  value,
  depth,
  hasChildren,
  onSymbolClick,
  compact = false,
  toggleRowExpanded,
}: {
  row: Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>;
  value: string;
  depth: number;
  hasChildren: boolean;
  onSymbolClick: (symbol: string) => void;
  compact?: boolean;
  toggleRowExpanded: (id: string[], value?: boolean) => void;
}) {
  const styles = useStyles2(getStyles);

  const expandSingleChildChain = (node: CallTreeNode) => {
    if (node.children?.length === 1) {
      const childNode = node.children[0];
      toggleRowExpanded([childNode.id], true);
      if (childNode.children && childNode.children.length > 0) {
        expandSingleChildChain(childNode);
      }
    }
  };

  const handleClick = () => {
    if (hasChildren) {
      const wasExpanded = row.isExpanded;
      row.toggleRowExpanded();
      if (!wasExpanded) {
        expandSingleChildChain(row.original);
      }
    }
    onSymbolClick(value);
  };

  // React Table leaves row.isExpanded undefined for collapsed rows, which would drop aria-expanded.
  const isRowExpanded = Boolean(row.isExpanded);

  return (
    <div className={styles.functionCellContainer} style={{ paddingLeft: depth * 16 }}>
      <span className={styles.functionNameWrapper}>
        <Button
          fill="text"
          size="sm"
          onClick={handleClick}
          className={cx(styles.functionButton, hasChildren && styles.functionButtonWithExpander)}
          aria-expanded={hasChildren ? isRowExpanded : undefined}
        >
          {hasChildren ? (
            <Icon
              name={isRowExpanded ? 'angle-down' : 'angle-right'}
              size="sm"
              data-testid="call-tree-row-expander"
              className={styles.expander}
            />
          ) : (
            <span aria-hidden="true" className={styles.expanderPlaceholder} />
          )}
          {value}
        </Button>
        {!compact && row.original.children && row.original.children.length > 0 && (
          <span className={styles.nodeBadge}>
            {row.original.children.length} {row.original.children.length === 1 ? 'child' : 'children'},{' '}
            {row.original.subtreeSize} {row.original.subtreeSize === 1 ? 'node' : 'nodes'}
          </span>
        )}
      </span>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    functionCellContainer: css({
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      height: '20px',
      lineHeight: '1',
      overflow: 'hidden',
      minWidth: 0,
    }),
    expander: css({
      label: 'expander',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '16px',
      height: '16px',
      padding: 0,
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
    expanderPlaceholder: css({
      label: 'expanderPlaceholder',
      display: 'inline-flex',
      width: '16px',
      height: '16px',
      flexShrink: 0,
    }),
    functionNameWrapper: css({
      display: 'inline-flex',
      alignItems: 'center',
      overflow: 'hidden',
      minWidth: 0,
    }),
    functionButton: css({
      padding: 0,
      fontSize: theme.typography.fontSize,
      textAlign: 'left',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0,
      flexShrink: 1,
    }),
    functionButtonWithExpander: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }),
    nodeBadge: css({
      marginLeft: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }),
  };
}
