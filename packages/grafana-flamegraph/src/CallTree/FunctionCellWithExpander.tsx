import { css } from '@emotion/css';
import { type Row, type UseExpandedRowProps } from 'react-table';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { type CallTreeNode } from './utils';

export function FunctionCellWithExpander({
  row,
  value,
  depth,
  hasChildren,
  rowIndex,
  rows,
  onSymbolClick,
  compact = false,
  toggleRowExpanded,
}: {
  row: Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>;
  value: string;
  depth: number;
  hasChildren: boolean;
  rowIndex?: number;
  rows: Array<Row<CallTreeNode>>;
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

  const isLastVisibleChildAtIndex = (index: number): boolean => {
    if (index === undefined) {
      return false;
    }

    const currentRow = rows[index];
    const parentId = currentRow.original.parentId;

    for (let i = index + 1; i < rows.length; i++) {
      if (rows[i].original.parentId === parentId) {
        return false;
      }
      if (rows[i].original.depth <= currentRow.original.depth) {
        break;
      }
    }
    return true;
  };

  const buildTreeConnector = () => {
    if (depth === 0) {
      return null;
    }

    const lines: string[] = [];

    const nodeIdToNode = new Map<string, CallTreeNode>();
    rows.forEach((r) => {
      nodeIdToNode.set(r.original.id, r.original);
    });

    const hasMoreNodesAtDepth = (targetDepth: number): boolean => {
      if (rowIndex === undefined) {
        return false;
      }

      for (let i = rowIndex + 1; i < rows.length; i++) {
        const checkRow = rows[i];

        if (checkRow.original.depth === targetDepth) {
          return true;
        }

        if (checkRow.original.depth < targetDepth) {
          break;
        }
      }
      return false;
    };

    let currentNode = row.original;

    while (currentNode.parentId && currentNode.depth > 0) {
      const parent = nodeIdToNode.get(currentNode.parentId);
      if (parent) {
        currentNode = parent;
      } else {
        break;
      }
    }

    for (let i = 0; i < depth - 1; i++) {
      if (hasMoreNodesAtDepth(i + 1)) {
        lines.push('│ ');
      } else {
        lines.push('  ');
      }
    }

    const isLastChild = rowIndex !== undefined ? isLastVisibleChildAtIndex(rowIndex) : false;
    lines.push(isLastChild ? '└─' : '├─');

    return lines.join('');
  };

  const connector = buildTreeConnector();

  return (
    <div className={styles.functionCellContainer}>
      {connector && <span className={styles.treeConnector}>{connector} </span>}
      <span className={styles.functionNameWrapper}>
        <Button fill="text" size="sm" onClick={handleClick} className={styles.functionButton}>
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
    treeConnector: css({
      color: theme.colors.text.secondary,
      fontSize: '16px',
      lineHeight: '1',
      fontFamily: 'monospace',
      whiteSpace: 'pre',
      display: 'inline-block',
      verticalAlign: 'middle',
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
    nodeBadge: css({
      marginLeft: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }),
  };
}
