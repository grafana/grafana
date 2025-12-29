import { css, cx } from '@emotion/css';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTable, useSortBy, useExpanded, Column, Row, UseExpandedRowProps } from 'react-table';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useDebounce, usePrevious } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ButtonGroup, Dropdown, Input, Menu, useStyles2, useTheme2 } from '@grafana/ui';

import { byPackageGradient, byValueGradient, diffColorBlindGradient, diffDefaultGradient } from '../FlameGraph/colors';
import { getBarColorByDiff, getBarColorByPackage, getBarColorByValue } from '../FlameGraph/colors';
import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { labelSearch } from '../FlameGraphContainer';
import { ColorScheme, ColorSchemeDiff } from '../types';
import {
  buildAllCallTreeNodes,
  CallTreeNode,
  filterCallTree,
  getExpandedStateForMatches,
  getInitialExpandedState,
} from './utils';

type Props = {
  data: FlameGraphDataContainer;
  onSymbolClick: (symbol: string) => void;
  search?: string;
  matchedLabels?: Set<string>;
  sandwichItem?: string;
  onSearch: (str: string) => void;
  onSandwich: (str?: string) => void;
  onTableSort?: (sort: string) => void;
  colorScheme: ColorScheme | ColorSchemeDiff;
};

const FlameGraphCallTreeContainer = memo(
  ({ data, onSymbolClick, search, matchedLabels, onSearch, sandwichItem, onSandwich, onTableSort, colorScheme: initialColorScheme }: Props) => {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    // Color scheme state
    const [colorScheme, setColorScheme] = useState<ColorScheme | ColorSchemeDiff>(initialColorScheme);

    // Focus state - track which node is focused
    const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(undefined);

    // Update color scheme when prop changes
    useEffect(() => {
      setColorScheme(initialColorScheme);
    }, [initialColorScheme]);

    // Search with debouncing
    const [localSearch, setLocalSearch] = useSearchInput(search || '', onSearch);

    // Get matched labels from search
    const searchMatchedLabels = useMemo(() => {
      if (!localSearch) {
        return undefined;
      }
      return labelSearch(localSearch, data);
    }, [localSearch, data]);

    // Use search-based matched labels if available, otherwise use prop
    const effectiveMatchedLabels = searchMatchedLabels || matchedLabels;

    // Build and filter nodes
    const { nodes, matchingIds, focusedNode } = useMemo(() => {
      const allNodes = buildAllCallTreeNodes(data);

      // If there's a focused node, find it and use its subtree
      let nodesToUse = allNodes;
      let focused: CallTreeNode | undefined;

      if (focusedNodeId) {
        // Find the focused node in the tree
        const findNode = (nodes: CallTreeNode[], id: string): CallTreeNode | undefined => {
          for (const node of nodes) {
            if (node.id === id) {
              return node;
            }
            if (node.subRows) {
              const found = findNode(node.subRows, id);
              if (found) return found;
            }
          }
          return undefined;
        };

        focused = findNode(allNodes, focusedNodeId);
        if (focused) {
          // Use the focused node as the root
          nodesToUse = [focused];
        }
      }

      const { visibleNodes, matchingNodeIds } = filterCallTree(nodesToUse, effectiveMatchedLabels);
      return { nodes: visibleNodes, matchingIds: matchingNodeIds, focusedNode: focused };
    }, [data, effectiveMatchedLabels, focusedNodeId]);

    // Calculate expanded state based on search
    const calculatedExpanded = useMemo(() => {
      const baseExpanded = getInitialExpandedState(nodes, 2);
      console.log('Calculated base expanded:', {
        numBaseExpanded: Object.keys(baseExpanded).filter(k => baseExpanded[k]).length,
        totalNodes: nodes.length,
        firstNode: nodes[0]?.id,
        expandedKeys: Object.keys(baseExpanded).filter(k => baseExpanded[k]),
      });

      // If there's a focused node, expand it using react-table's row ID
      // The focused node becomes the root, so its react-table ID is "0"
      if (focusedNodeId && nodes.length > 0 && nodes[0].id === focusedNodeId && nodes[0].hasChildren) {
        baseExpanded['0'] = true;
      }

      if (effectiveMatchedLabels && effectiveMatchedLabels.size > 0) {
        const matchExpanded = getExpandedStateForMatches(nodes, matchingIds);
        console.log('Adding match expansion:', {
          numMatchExpanded: Object.keys(matchExpanded).filter(k => matchExpanded[k]).length,
          matchExpandedKeys: Object.keys(matchExpanded).filter(k => matchExpanded[k]),
          matchingIds: Array.from(matchingIds),
          hasSearch: true,
        });
        return { ...baseExpanded, ...matchExpanded };
      }
      return baseExpanded;
    }, [nodes, effectiveMatchedLabels, matchingIds, focusedNodeId]);

    // Create a key that changes when expansion should reset, forcing table remount
    const tableKey = useMemo(() => {
      // Include matchingIds in the key so table remounts when search results change
      const expandedKeys = Object.keys(calculatedExpanded).filter(k => calculatedExpanded[k]).sort().join(',');
      const focusPart = focusedNodeId ? `-focus-${focusedNodeId}` : '';
      return `table-${expandedKeys}${focusPart}`;
    }, [calculatedExpanded, focusedNodeId]);

    // Callback to handle recursive expand/collapse - will be populated after tableInstance is created
    const handleToggleExpandRef = useRef<((node: CallTreeNode, rowId: string, isExpanded: boolean) => void) | null>(null);


    // Define columns
    const columns: Column<CallTreeNode>[] = useMemo(() => {
      if (data.isDiffFlamegraph()) {
        return [
          {
            Header: '',
            id: 'actions',
            Cell: ({ row }: { row: Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode> }) => (
              <ActionsCell
                row={row}
                onFocus={(nodeId) => {
                  setFocusedNodeId(nodeId);
                  setLocalSearch('');
                }}
                onToggleExpand={(isExpanded) => {
                  if (handleToggleExpandRef.current) {
                    handleToggleExpandRef.current(row.original, row.id, isExpanded);
                  }
                }}
                isFocusedRoot={row.id === '0'}
                styles={styles}
              />
            ),
            width: 50,
            minWidth: 50,
            disableSortBy: true,
          },
          {
            Header: 'Function',
            accessor: 'label',
            Cell: ({ row, value, rowIndex }: { row: Row<CallTreeNode>; value: string; rowIndex?: number }) => (
              <FunctionCellWithExpander
                row={row as Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>}
                value={value}
                depth={row.original.depth}
                hasChildren={row.original.hasChildren}
                rowIndex={rowIndex}
                rows={tableInstance.rows}
                isMatching={matchingIds.has(row.original.id)}
                hasFilter={effectiveMatchedLabels !== undefined && effectiveMatchedLabels.size > 0}
                onSymbolClick={onSymbolClick}
                styles={styles}
                allNodes={nodes}
              />
            ),
            minWidth: 200,
            width: undefined,
          },
          {
            Header: '',
            id: 'colorBar',
            Cell: ({ row }: { row: Row<CallTreeNode> }) => (
              <ColorBarCell node={row.original} data={data} colorScheme={colorScheme} theme={theme} styles={styles} />
            ),
            minWidth: 200,
            width: 200,
            disableSortBy: true,
          },
          {
            Header: 'Baseline %',
            accessor: 'selfPercent',
            Cell: ({ value }: { value: number }) => `${value.toFixed(2)}%`,
            sortType: 'basic',
            width: 100,
          },
          {
            Header: 'Comparison %',
            accessor: 'selfPercentRight',
            Cell: ({ value }: { value: number | undefined }) => (value !== undefined ? `${value.toFixed(2)}%` : '-'),
            sortType: 'basic',
            width: 100,
          },
          {
            Header: 'Diff %',
            accessor: 'diffPercent',
            Cell: ({ value }: { value: number | undefined }) => (
              <DiffCell value={value} colorScheme={colorScheme} theme={theme} styles={styles} />
            ),
            sortType: 'basic',
            width: 100,
          },
        ];
      } else {
        return [
          {
            Header: '',
            id: 'actions',
            Cell: ({ row }: { row: Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode> }) => (
              <ActionsCell
                row={row}
                onFocus={(nodeId) => {
                  setFocusedNodeId(nodeId);
                  setLocalSearch('');
                }}
                onToggleExpand={(isExpanded) => {
                  if (handleToggleExpandRef.current) {
                    handleToggleExpandRef.current(row.original, row.id, isExpanded);
                  }
                }}
                isFocusedRoot={row.id === '0'}
                styles={styles}
              />
            ),
            width: 50,
            minWidth: 50,
            disableSortBy: true,
          },
          {
            Header: 'Function',
            accessor: 'label',
            Cell: ({ row, value, rowIndex }: { row: Row<CallTreeNode>; value: string; rowIndex?: number }) => (
              <FunctionCellWithExpander
                row={row as Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>}
                value={value}
                depth={row.original.depth}
                hasChildren={row.original.hasChildren}
                rowIndex={rowIndex}
                rows={tableInstance.rows}
                isMatching={matchingIds.has(row.original.id)}
                hasFilter={effectiveMatchedLabels !== undefined && effectiveMatchedLabels.size > 0}
                onSymbolClick={onSymbolClick}
                styles={styles}
                allNodes={nodes}
              />
            ),
            minWidth: 200,
            width: undefined,
          },
          {
            Header: '',
            id: 'colorBar',
            Cell: ({ row }: { row: Row<CallTreeNode> }) => (
              <ColorBarCell node={row.original} data={data} colorScheme={colorScheme} theme={theme} styles={styles} />
            ),
            minWidth: 200,
            width: 200,
            disableSortBy: true,
          },
          {
            Header: 'Self',
            accessor: 'self',
            Cell: ({ row }: { row: Row<CallTreeNode> }) => {
              const displaySelf = data.getSelfDisplay([row.original.levelItem.itemIndexes[0]]);
              const formattedValue = displaySelf.suffix ? displaySelf.text + displaySelf.suffix : displaySelf.text;
              return (
                <div className={styles.valueCell}>
                  <span className={styles.valueNumber}>{formattedValue}</span>
                  <span className={styles.percentNumber}>{row.original.selfPercent.toFixed(2)}%</span>
                </div>
              );
            },
            sortType: 'basic',
            minWidth: 120,
            width: 120,
          },
          {
            Header: 'Total',
            accessor: 'total',
            Cell: ({ row }: { row: Row<CallTreeNode> }) => {
              const displayValue = data.valueDisplayProcessor(row.original.total);
              const formattedValue = displayValue.suffix ? displayValue.text + displayValue.suffix : displayValue.text;
              return (
                <div className={styles.valueCell}>
                  <span className={styles.valueNumber}>{formattedValue}</span>
                  <span className={styles.percentNumber}>{row.original.totalPercent.toFixed(2)}%</span>
                </div>
              );
            },
            sortType: 'basic',
            minWidth: 120,
            width: 120,
          },
        ];
      }
    }, [data, effectiveMatchedLabels, matchingIds, onSymbolClick, colorScheme, theme, styles, setLocalSearch]);

    // toggleRowExpanded is used in the Cell renderers but doesn't need to be in the dependencies
    // because it's accessed at render time, not definition time

    // Setup table instance with expand and sort
    // Using initialState - expansion resets when data changes so new initialState takes effect
    const tableInstance = useTable<CallTreeNode>(
      {
        columns,
        data: nodes,
        getSubRows: (row) => row.subRows || [],
        initialState: {
          expanded: calculatedExpanded,
          sortBy: [{ id: 'total', desc: true }],
        },
        autoResetExpanded: true, // Reset expansion when data changes so initialState applies
        autoResetSortBy: false,
      },
      useSortBy,
      useExpanded
    );

    const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow, state, toggleAllRowsExpanded, toggleRowExpanded } = tableInstance;

    // Set up the recursive expand/collapse handler now that we have toggleRowExpanded
    // We need to find the actual row ID that react-table uses, which may differ from node.id
    handleToggleExpandRef.current = (node: CallTreeNode, rowId: string, isExpanded: boolean) => {
      const toggleRecursive = (rId: string, n: CallTreeNode, expand: boolean) => {
        toggleRowExpanded(rId, expand);
        if (n.subRows) {
          n.subRows.forEach((child, index) => {
            const childRowId = `${rId}.${index}`;
            toggleRecursive(childRowId, child, expand);
          });
        }
      };
      toggleRecursive(rowId, node, !isExpanded);
    };

    console.log('Table state:', {
      visibleRows: rows.length,
      expandedState: Object.keys(state.expanded).filter(k => state.expanded[k]).length,
      expandedIds: Object.keys(state.expanded).filter(k => state.expanded[k]),
      firstFewRows: rows.slice(0, 5).map(r => ({
        id: r.id,
        originalId: r.original.id,
        label: r.original.label,
        isExpanded: (r as any).isExpanded,
        hasSubRows: !!r.original.subRows
      })),
      rootNodeSubRows: nodes[0]?.subRows?.length,
    });

    const clearSearchSuffix =
      localSearch !== '' ? (
        <Button
          icon="times"
          fill="text"
          size="sm"
          onClick={() => {
            setLocalSearch('');
          }}
        >
          Clear
        </Button>
      ) : null;

    return (
      <div className={styles.container} data-testid="callTree">
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <Input
              value={localSearch}
              onChange={(v) => {
                setLocalSearch(v.currentTarget.value);
              }}
              placeholder={'Search...'}
              suffix={clearSearchSuffix}
              className={styles.searchInput}
            />
          </div>

          {focusedNode && (
            <div className={styles.focusedItem}>
              <Button icon="eye" fill="text" size="sm" disabled aria-label="Focused" />
              <span className={styles.focusedItemLabel}>{focusedNode.label}</span>
              <Button
                icon="times"
                fill="text"
                size="sm"
                onClick={() => setFocusedNodeId(undefined)}
                tooltip="Clear focus"
                aria-label="Clear focus"
              />
            </div>
          )}

          <div className={styles.toolbarRight}>
            <ColorSchemeButton value={colorScheme} onChange={setColorScheme} isDiffMode={data.isDiffFlamegraph()} />
            <ButtonGroup className={styles.buttonSpacing}>
              <Button
                variant={'secondary'}
                fill={'outline'}
                size={'sm'}
                tooltip={'Expand all'}
                onClick={() => toggleAllRowsExpanded(true)}
                aria-label={'Expand all'}
                icon={'angle-double-down'}
              />
              <Button
                variant={'secondary'}
                fill={'outline'}
                size={'sm'}
                tooltip={'Collapse all'}
                onClick={() => toggleAllRowsExpanded(false)}
                aria-label={'Collapse all'}
                icon={'angle-double-up'}
              />
            </ButtonGroup>
          </div>
        </div>

        <AutoSizer key={tableKey} style={{ width: '100%', height: 'calc(100% - 50px)' }}>
          {({ width, height }) => {
            if (width < 3 || height < 3) {
              return null;
            }

            return (
              <div style={{ width, height, overflow: 'auto' }}>
                <table {...getTableProps()} className={styles.table}>
                  <thead className={styles.thead}>
                    {headerGroups.map((headerGroup) => {
                      const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
                      return (
                        <tr key={key} {...headerGroupProps}>
                          {headerGroup.headers.map((column) => {
                            const { key: headerKey, ...headerProps } = column.getHeaderProps(
                              column.getSortByToggleProps()
                            );
                            return (
                              <th
                                key={headerKey}
                                {...headerProps}
                                className={styles.th}
                                style={{
                                  ...(column.width !== undefined && { width: column.width }),
                                  textAlign: column.id === 'self' || column.id === 'total' ? 'right' : undefined,
                                  ...(column.minWidth !== undefined && { minWidth: column.minWidth })
                                }}
                              >
                                {column.render('Header')}
                                <span className={styles.sortIndicator}>
                                  {column.isSorted ? (column.isSortedDesc ? ' ▼' : ' ▲') : ''}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </thead>
                  <tbody {...getTableBodyProps()} className={styles.tbody}>
                    {rows.map((row, rowIndex) => {
                      prepareRow(row);
                      const { key, ...rowProps } = row.getRowProps();
                      return (
                        <tr key={key} {...rowProps} className={styles.tr}>
                          {row.cells.map((cell) => {
                            const { key: cellKey, ...cellProps } = cell.getCellProps();
                            const isValueColumn = cell.column.id === 'self' || cell.column.id === 'total';
                            const isActionsColumn = cell.column.id === 'actions';
                            return (
                              <td
                                key={cellKey}
                                {...cellProps}
                                className={cx(styles.td, isActionsColumn && styles.actionsColumnCell)}
                                style={isValueColumn ? { textAlign: 'right' } : undefined}
                              >
                                {cell.render('Cell', { rowIndex })}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }}
        </AutoSizer>
      </div>
    );
  }
);

FlameGraphCallTreeContainer.displayName = 'FlameGraphCallTreeContainer';

// ColorSchemeButton component
type ColorSchemeButtonProps = {
  value: ColorScheme | ColorSchemeDiff;
  onChange: (colorScheme: ColorScheme | ColorSchemeDiff) => void;
  isDiffMode: boolean;
};

function ColorSchemeButton(props: ColorSchemeButtonProps) {
  const styles = useStyles2(getStyles);

  let menu = (
    <Menu>
      <Menu.Item label="By package name" onClick={() => props.onChange(ColorScheme.PackageBased)} />
      <Menu.Item label="By value" onClick={() => props.onChange(ColorScheme.ValueBased)} />
    </Menu>
  );

  const colorDotStyle =
    {
      [ColorScheme.ValueBased]: styles.colorDotByValue,
      [ColorScheme.PackageBased]: styles.colorDotByPackage,
      [ColorSchemeDiff.DiffColorBlind]: styles.colorDotDiffColorBlind,
      [ColorSchemeDiff.Default]: styles.colorDotDiffDefault,
    }[props.value] || styles.colorDotByValue;

  let contents = <span className={cx(styles.colorDot, colorDotStyle)} />;

  if (props.isDiffMode) {
    menu = (
      <Menu>
        <Menu.Item label="Default (green to red)" onClick={() => props.onChange(ColorSchemeDiff.Default)} />
        <Menu.Item label="Color blind (blue to red)" onClick={() => props.onChange(ColorSchemeDiff.DiffColorBlind)} />
      </Menu>
    );

    contents = (
      <div className={cx(styles.colorDotDiff, colorDotStyle)}>
        <div>-100% (removed)</div>
        <div>0%</div>
        <div>+100% (added)</div>
      </div>
    );
  }

  return (
    <Dropdown overlay={menu}>
      <Button
        variant={'secondary'}
        fill={'outline'}
        size={'sm'}
        tooltip={'Change color scheme'}
        onClick={() => {}}
        className={styles.buttonSpacing}
        aria-label={'Change color scheme'}
      >
        {contents}
      </Button>
    </Dropdown>
  );
}

// Helper function to get row background color
function getRowBackgroundColor(
  node: CallTreeNode,
  data: FlameGraphDataContainer,
  colorScheme: ColorScheme | ColorSchemeDiff,
  theme: GrafanaTheme2
): string {
  if (data.isDiffFlamegraph()) {
    // For diff profiles, use diff coloring
    const levels = data.getLevels();
    const rootTotal = levels[0][0].value;
    const rootTotalRight = levels[0][0].valueRight || 0;

    const barColor = getBarColorByDiff(
      node.total,
      node.totalRight || 0,
      rootTotal,
      rootTotalRight,
      colorScheme as ColorSchemeDiff
    );
    return barColor.setAlpha(1.0).toString();
  } else {
    // For regular profiles
    if (colorScheme === ColorScheme.ValueBased) {
      const levels = data.getLevels();
      const rootTotal = levels[0][0].value;
      const barColor = getBarColorByValue(node.total, rootTotal, 0, 1);
      return barColor.setAlpha(1.0).toString();
    } else {
      // PackageBased
      const barColor = getBarColorByPackage(node.label, theme);
      return barColor.setAlpha(1.0).toString();
    }
  }
}

// Cell Components

function ActionsCell({
  row,
  onFocus,
  onToggleExpand,
  isFocusedRoot,
  styles,
}: {
  row: Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>;
  onFocus: (nodeId: string) => void;
  onToggleExpand: (isExpanded: boolean) => void;
  isFocusedRoot: boolean;
  styles: any;
}) {
  const hasChildren = row.original.hasChildren;
  const isExpanded = row.isExpanded;

  return (
    <div className={styles.actionsCell}>
      <Button
        icon={isExpanded ? 'angle-double-up' : 'angle-double-down'}
        fill="text"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            onToggleExpand(isExpanded);
          }
        }}
        tooltip={isExpanded ? 'Collapse all' : 'Expand all'}
        aria-label={isExpanded ? 'Collapse all' : 'Expand all'}
        className={styles.actionButton}
        disabled={!hasChildren}
      />
      {!isFocusedRoot && (
        <Button
          icon="eye"
          fill="text"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onFocus(row.original.id);
          }}
          tooltip="Focus on this subtree"
          aria-label="Focus"
          className={styles.actionButton}
        />
      )}
    </div>
  );
}

function FunctionCellWithExpander({
  row,
  value,
  depth,
  hasChildren,
  rowIndex,
  rows,
  isMatching,
  hasFilter,
  onSymbolClick,
  styles,
  allNodes,
}: {
  row: Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>;
  value: string;
  depth: number;
  hasChildren: boolean;
  rowIndex?: number;
  rows: Array<Row<CallTreeNode>>;
  isMatching: boolean;
  hasFilter: boolean;
  onSymbolClick: (symbol: string) => void;
  styles: any;
  allNodes: CallTreeNode[];
}) {
  const opacity = hasFilter && !isMatching ? 0.5 : 1;
  const fontWeight = hasFilter && isMatching ? 'bold' : 'normal';

  const handleClick = () => {
    if (hasChildren) {
      row.toggleRowExpanded();
    }
    onSymbolClick(value);
  };

  // Helper to check if a node at a given row index is the last visible child of its parent
  const isLastVisibleChildAtIndex = (index: number): boolean => {
    if (index === undefined) return false;

    const currentRow = rows[index];
    const parentId = currentRow.original.parentId;

    // Find the next sibling (same parent, appears after current row)
    for (let i = index + 1; i < rows.length; i++) {
      if (rows[i].original.parentId === parentId) {
        return false; // Found a sibling, so not last
      }
      // If we encounter a node at same or higher level, stop searching
      if (rows[i].original.depth <= currentRow.original.depth) {
        break;
      }
    }
    return true; // No more siblings found
  };

  // Build the tree connector string
  const buildTreeConnector = () => {
    if (depth === 0) {
      return null;
    }

    const lines: string[] = [];

    // For each ancestor level, determine if we need a vertical line
    // We draw a vertical line if there are more siblings of that ancestor

    // Build a map of node ID to the actual node from rows (for flat access)
    const nodeIdToNode = new Map<string, CallTreeNode>();
    rows.forEach((r) => {
      nodeIdToNode.set(r.original.id, r.original);
    });

    // Helper to check if there are more siblings at the target depth level after current row
    const hasMoreNodesAtDepth = (targetDepth: number): boolean => {
      if (rowIndex === undefined) {
        return false;
      }

      // Look through rows after the CURRENT row
      for (let i = rowIndex + 1; i < rows.length; i++) {
        const checkRow = rows[i];

        // If we find a node at the target depth, there are more nodes at that level
        if (checkRow.original.depth === targetDepth) {
          return true;
        }

        // If we've reached a node at depth < targetDepth, we've left the subtree
        if (checkRow.original.depth < targetDepth) {
          break;
        }
      }
      return false;
    };

    // Walk up the parent chain to build ancestor list
    // We need to collect all parent nodes (not including current node or root)
    const ancestors: CallTreeNode[] = [];
    let currentNode = row.original;

    // Walk up the parent chain using the parentId
    while (currentNode.parentId && currentNode.depth > 0) {
      const parent = nodeIdToNode.get(currentNode.parentId);
      if (parent) {
        ancestors.unshift(parent);
        currentNode = parent;
      } else {
        break;
      }
    }

    // For each position before the current node's branch, check if vertical line needed
    for (let i = 0; i < depth - 1; i++) {
      // The vertical line at position i connects nodes at depth i+1
      // So check if there are more nodes at depth i+1 after the current row
      if (hasMoreNodesAtDepth(i + 1)) {
        lines.push('│ ');
      } else {
        lines.push('  ');
      }
    }

    // Add the branch character for the current node
    const isLastChild = rowIndex !== undefined ? isLastVisibleChildAtIndex(rowIndex) : false;
    lines.push(isLastChild ? '└─' : '├─');

    return lines.join('');
  };

  const connector = buildTreeConnector();

  return (
    <div className={styles.functionCellContainer} style={{ opacity, fontWeight }}>
      {connector && <span className={styles.treeConnector}>{connector} </span>}
      <Button fill="text" size="sm" onClick={handleClick} className={styles.functionButton}>
        {value}
      </Button>
    </div>
  );
}


function ColorBarCell({
  node,
  data,
  colorScheme,
  theme,
  styles,
}: {
  node: CallTreeNode;
  data: FlameGraphDataContainer;
  colorScheme: ColorScheme | ColorSchemeDiff;
  theme: GrafanaTheme2;
  styles: any;
}) {
  const barColor = getRowBackgroundColor(node, data, colorScheme, theme);
  const barWidth = `${Math.min(node.totalPercent, 100)}%`;

  return (
    <div className={styles.colorBarContainer}>
      <div className={styles.colorBar} style={{ width: barWidth, backgroundColor: barColor }} />
    </div>
  );
}

function DiffCell({
  value,
  colorScheme,
  theme,
  styles,
}: {
  value: number | undefined;
  colorScheme: ColorScheme | ColorSchemeDiff;
  theme: GrafanaTheme2;
  styles: any;
}) {
  if (value === undefined) {
    return <span>-</span>;
  }

  let displayValue: string;
  let color: string;

  if (value === Infinity) {
    displayValue = 'new';
    color = theme.colors.success.text;
  } else if (value === -100) {
    displayValue = 'removed';
    color = theme.colors.error.text;
  } else {
    displayValue = `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
    color = value > 0 ? theme.colors.error.text : theme.colors.success.text;
  }

  return <span style={{ color, fontWeight: 'bold' }}>{displayValue}</span>;
}

// Search hook with debouncing
function useSearchInput(
  search: string,
  setSearch: (search: string) => void
): [string, (search: string) => void] {
  const [localSearchState, setLocalSearchState] = useState(search);
  const prevSearch = usePrevious(search);

  // Debouncing cause changing parent search triggers rerender
  useDebounce(
    () => {
      setSearch(localSearchState);
    },
    250,
    [localSearchState]
  );

  // Make sure we still handle updates from parent (from clicking on a table item for example)
  useEffect(() => {
    if (prevSearch !== search && search !== localSearchState) {
      setLocalSearchState(search);
    }
  }, [search, prevSearch, localSearchState]);

  return [localSearchState, setLocalSearchState];
}

// Styles

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.background.primary,
      display: 'flex',
      flexDirection: 'column',
    }),
    toolbar: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
      gap: theme.spacing(1),
      flexWrap: 'wrap',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    toolbarLeft: css({
      flexGrow: 1,
      minWidth: '150px',
      maxWidth: '350px',
    }),
    toolbarRight: css({
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    }),
    searchInput: css({
      width: '100%',
    }),
    buttonSpacing: css({
      marginRight: theme.spacing(1),
    }),
    colorDot: css({
      display: 'inline-block',
      width: '10px',
      height: '10px',
      borderRadius: theme.shape.radius.circle,
    }),
    colorDotDiff: css({
      display: 'flex',
      width: '200px',
      height: '12px',
      color: 'white',
      fontSize: 9,
      lineHeight: 1.3,
      fontWeight: 300,
      justifyContent: 'space-between',
      padding: '0 2px',
      borderRadius: '2px',
    }),
    colorDotByValue: css({
      background: byValueGradient,
    }),
    colorDotByPackage: css({
      background: byPackageGradient,
    }),
    colorDotDiffDefault: css({
      background: diffDefaultGradient,
    }),
    colorDotDiffColorBlind: css({
      background: diffColorBlindGradient,
    }),
    table: css({
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: theme.typography.fontSize,
      color: theme.colors.text.primary,
    }),
    thead: css({
      backgroundColor: theme.colors.background.secondary,
      position: 'sticky',
      top: 0,
      zIndex: 1,
    }),
    th: css({
      padding: '4px 6px',
      textAlign: 'left',
      fontWeight: theme.typography.fontWeightMedium,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      cursor: 'pointer',
      userSelect: 'none',
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    }),
    tbody: css({
      backgroundColor: theme.colors.background.primary,
    }),
    tr: css({
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
    }),
    td: css({
      padding: '0px 6px',
      borderBottom: 'none',
      height: '20px',
      verticalAlign: 'middle',
    }),
    valueCell: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      fontVariantNumeric: 'tabular-nums',
      height: '20px',
    }),
    valueNumber: css({
      flex: '1 1 auto',
      textAlign: 'right',
      minWidth: '80px',
    }),
    percentNumber: css({
      flex: '0 0 70px',
      textAlign: 'right',
      width: '70px',
      color: theme.colors.text.secondary,
    }),
    functionCellContainer: css({
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      height: '20px',
      lineHeight: '1',
    }),
    treeConnector: css({
      color: theme.colors.text.secondary,
      fontSize: '16px',
      lineHeight: '1',
      fontFamily: 'monospace',
      whiteSpace: 'pre',
      display: 'inline-block',
      verticalAlign: 'middle',
    }),
    functionButton: css({
      padding: 0,
      fontSize: theme.typography.fontSize,
      textAlign: 'left',
    }),
    sortIndicator: css({
      marginLeft: '4px',
      fontSize: '10px',
    }),
    colorBarContainer: css({
      width: '100%',
      height: '20px',
      display: 'flex',
      alignItems: 'center',
    }),
    colorBar: css({
      height: '16px',
      minWidth: '2px',
      borderRadius: '2px',
    }),
    actionsCell: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      height: '20px',
    }),
    actionsColumnCell: css({
      backgroundColor: theme.colors.background.secondary,
      '&:hover': {
        backgroundColor: theme.colors.background.secondary,
      },
    }),
    actionButton: css({
      padding: 0,
      minWidth: 'auto',
      height: '20px',
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    focusedItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    focusedItemLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
}

export default FlameGraphCallTreeContainer;
