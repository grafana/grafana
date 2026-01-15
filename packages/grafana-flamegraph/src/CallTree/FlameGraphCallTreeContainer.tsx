import { css, cx } from '@emotion/css';
import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { useTable, useSortBy, useExpanded, Column, Row, UseExpandedRowProps } from 'react-table';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, IconButton, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';

import { getBarColorByDiff, getBarColorByPackage, getBarColorByValue } from '../FlameGraph/colors';
import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { ColorScheme, ColorSchemeDiff } from '../types';
import {
  buildAllCallTreeNodes,
  buildCallersTreeFromLevels,
  CallTreeNode,
  getInitialExpandedState,
} from './utils';

type Props = {
  data: FlameGraphDataContainer;
  onSymbolClick: (symbol: string) => void;
  sandwichItem?: string;
  onSandwich: (str?: string) => void;
  onTableSort?: (sort: string) => void;
  colorScheme: ColorScheme | ColorSchemeDiff;
  search: string;
  compact?: boolean;
  onSearch?: (symbol: string) => void;
  /** Item indexes of the focused item in the flame graph, to highlight the exact node in the call tree */
  highlightedItemIndexes?: number[];
};

const FlameGraphCallTreeContainer = memo(
  ({ data, onSymbolClick, sandwichItem, onSandwich, onTableSort, colorScheme: initialColorScheme, search, compact = false, onSearch, highlightedItemIndexes }: Props) => {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    // Ref for the matched search row to enable auto-scrolling
    const searchMatchRowRef = useRef<HTMLTableRowElement | null>(null);

    // Ref for the highlighted row (from flame graph focus) to enable auto-scrolling
    const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

    // Use package-based color scheme by default
    const colorScheme = data.isDiffFlamegraph() ? ColorSchemeDiff.Default : ColorScheme.PackageBased;

    // Focus state - track which node is focused
    const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(undefined);

    // Callers state - track which function's callers we're showing
    const [callersNodeLabel, setCallersNodeLabel] = useState<string | undefined>(undefined);

    // Sync callers mode with sandwich item from flame graph
    // When sandwich mode is activated, automatically enter callers mode for that function
    // When sandwich mode is cleared, exit callers mode
    useEffect(() => {
      if (sandwichItem !== undefined) {
        // Enter callers mode for the sandwiched function
        setCallersNodeLabel(sandwichItem);
        setFocusedNodeId(undefined); // Clear focus mode when entering callers mode
      } else {
        // Exit callers mode when sandwich is cleared
        setCallersNodeLabel(undefined);
      }
    }, [sandwichItem]);

    // Search state - use search from parent (shared with TopTable and FlameGraph)
    const searchQuery = search;
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
    const [searchError, setSearchError] = useState<string | undefined>(undefined);

    // Wrapper functions for mutual exclusivity
    const handleSetFocusMode = (nodeIdOrLabel: string | undefined, isLabel: boolean = false) => {
      if (nodeIdOrLabel === undefined) {
        setFocusedNodeId(undefined);
      } else if (isLabel) {
        // When switching from callers mode, we need to find the node by label in the normal tree
        // We'll set a special marker that the useMemo will use to find the node
        setFocusedNodeId(`label:${nodeIdOrLabel}`);
      } else {
        setFocusedNodeId(nodeIdOrLabel);
      }

      if (nodeIdOrLabel !== undefined) {
        setCallersNodeLabel(undefined);
      }
    };

    const handleSetCallersMode = (label: string | undefined) => {
      setCallersNodeLabel(label);
      if (label !== undefined) {
        setFocusedNodeId(undefined);
      }
    };

    // Build nodes - dependencies include currentSearchMatchId to force rebuild when search match changes
    const { nodes, focusedNode, callersNode } = useMemo(() => {
      const allNodes = buildAllCallTreeNodes(data);

      // If there's a focused node, find it and use its subtree with parent
      let nodesToUse = allNodes;
      let focused: CallTreeNode | undefined;
      let callersTargetNode: CallTreeNode | undefined;

      if (focusedNodeId) {
        // Check if we're searching by label (when switching from callers mode)
        const isLabelSearch = focusedNodeId.startsWith('label:');
        const searchKey = isLabelSearch ? focusedNodeId.substring(6) : focusedNodeId;

        // Find the focused node in the tree
        const findNode = (nodes: CallTreeNode[], searchKey: string, byLabel: boolean): CallTreeNode | undefined => {
          for (const node of nodes) {
            if (byLabel ? node.label === searchKey : node.id === searchKey) {
              return node;
            }
            if (node.subRows) {
              const found = findNode(node.subRows, searchKey, byLabel);
              if (found) return found;
            }
          }
          return undefined;
        };

        focused = findNode(allNodes, searchKey, isLabelSearch);
        if (focused) {
          // If we searched by label, update the focusedNodeId to use the actual ID
          if (isLabelSearch) {
            // Update state to use the actual ID for future operations
            // We do this asynchronously to avoid updating state during render
            setTimeout(() => setFocusedNodeId(focused!.id), 0);
          }

          // If the focused node has a parent, show parent with focused node as only child
          if (focused.parentId) {
            const parent = findNode(allNodes, focused.parentId, false);
            if (parent) {
              // Create a modified parent that only shows the focused node as its child
              const modifiedParent: CallTreeNode = {
                ...parent,
                subRows: [focused],
                hasChildren: true,
                childCount: 1,
              };
              nodesToUse = [modifiedParent];
            } else {
              // Parent not found, just use focused node
              nodesToUse = [focused];
            }
          } else {
            // No parent, use the focused node as the root
            nodesToUse = [focused];
          }
        }
      }

      // If there's a callers mode active, build the inverted tree
      if (callersNodeLabel) {
        const [callers, _] = data.getSandwichLevels(callersNodeLabel);

        if (callers.length > 0 && callers[0].length > 0) {
          const levels = data.getLevels();
          const rootTotal = levels.length > 0 ? levels[0][0].value : 0;

          // Build inverted tree directly with target as root and callers as children
          const { tree, targetNode } = buildCallersTreeFromLevels(callers, callersNodeLabel, data, rootTotal);

          nodesToUse = tree;
          callersTargetNode = targetNode;
        } else {
          // No callers found - show empty tree
          nodesToUse = [];
          callersTargetNode = undefined;
        }
      }

      return { nodes: nodesToUse, focusedNode: focused, callersNode: callersTargetNode };
    }, [data, focusedNodeId, callersNodeLabel]);

    // Search function - finds matching nodes in the tree
    const searchNodes = useMemo(() => {
      if (!searchQuery.trim()) {
        return [];
      }

      const MAX_MATCHES = 50;
      const matches: Array<{ id: string; total: number }> = [];

      // Determine if the query is a regex pattern (contains regex special chars)
      const regexChars = /[.*+?^${}()|[\]\\]/;
      let isRegexQuery = regexChars.test(searchQuery);
      let searchRegex: RegExp | null = null;

      if (isRegexQuery) {
        try {
          searchRegex = new RegExp(searchQuery, 'i');
          setSearchError(undefined);
        } catch (e) {
          setSearchError('Invalid regex pattern');
          return [];
        }
      }

      // Recursive search through nodes
      const search = (nodesToSearch: CallTreeNode[]) => {
        for (const node of nodesToSearch) {
          if (matches.length >= MAX_MATCHES) {
            break;
          }

          // Match against node label
          let isMatch = false;
          if (searchRegex) {
            isMatch = searchRegex.test(node.label);
          } else {
            isMatch = node.label.toLowerCase().includes(searchQuery.toLowerCase());
          }

          if (isMatch) {
            matches.push({ id: node.id, total: node.total });
          }

          // Recursively search children
          if (node.subRows && matches.length < MAX_MATCHES) {
            search(node.subRows);
          }
        }
      };

      search(nodes);

      // Sort by total time descending (most significant first)
      matches.sort((a, b) => b.total - a.total);

      const matchIds = matches.map(m => m.id);

      setSearchError(undefined);
      return matchIds;
    }, [searchQuery, nodes]);

    // Find the node matching the highlighted item indexes (from flame graph focus)
    // This finds the exact node in the call tree by matching the LevelItem's itemIndexes
    const highlightedNodeId = useMemo(() => {
      if (!highlightedItemIndexes || highlightedItemIndexes.length === 0) {
        return undefined;
      }

      // Helper to check if two itemIndexes arrays match
      const itemIndexesMatch = (a: number[], b: number[]): boolean => {
        if (a.length !== b.length) return false;
        return a.every((val, idx) => val === b[idx]);
      };

      // Find the exact node by matching itemIndexes
      const findExactMatch = (nodesToSearch: CallTreeNode[]): string | undefined => {
        for (const node of nodesToSearch) {
          if (itemIndexesMatch(node.levelItem.itemIndexes, highlightedItemIndexes)) {
            return node.id;
          }
          if (node.subRows) {
            const found = findExactMatch(node.subRows);
            if (found) return found;
          }
        }
        return undefined;
      };

      return findExactMatch(nodes);
    }, [highlightedItemIndexes, nodes]);

    // Auto-scroll to the highlighted row when it changes
    useEffect(() => {
      if (highlightedRowRef.current) {
        highlightedRowRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, [highlightedNodeId]);

    // Reset current match index when search results change
    const searchResultKey = searchNodes.join(',');
    useEffect(() => {
      setCurrentMatchIndex(searchNodes.length > 0 ? 0 : -1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchResultKey]);

    // Navigation functions for search results
    const navigateToNextMatch = () => {
      if (searchNodes.length > 0) {
        setCurrentMatchIndex((prev) => (prev + 1) % searchNodes.length);
      }
    };

    const navigateToPrevMatch = () => {
      if (searchNodes.length > 0) {
        setCurrentMatchIndex((prev) => (prev - 1 + searchNodes.length) % searchNodes.length);
      }
    };

    // Get current search match node ID
    const currentSearchMatchId = useMemo(() => {
      if (searchNodes.length > 0 && currentMatchIndex >= 0 && currentMatchIndex < searchNodes.length) {
        return searchNodes[currentMatchIndex];
      }
      return undefined;
    }, [searchNodes, currentMatchIndex]);

    // Auto-scroll to the matched row when current match changes
    useEffect(() => {
      if (searchMatchRowRef.current) {
        searchMatchRowRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, [currentMatchIndex, currentSearchMatchId]);

    // Calculate expanded state
    const calculatedExpanded = useMemo(() => {
      const baseExpanded = getInitialExpandedState(nodes, 1);

      // If there's a search match, expand path to show it
      if (currentSearchMatchId) {
        // Expand all nodes along the path to the current match
        const expandPathToNode = (nodes: CallTreeNode[], targetId: string): boolean => {
          for (const node of nodes) {
            if (node.id === targetId) {
              // Found the target
              return true;
            }
            if (node.subRows && node.hasChildren) {
              // Check if target is in this subtree
              const foundInSubtree = expandPathToNode(node.subRows, targetId);
              if (foundInSubtree) {
                // Target is in this subtree, so expand this node
                baseExpanded[node.id] = true;
                return true;
              }
            }
          }
          return false;
        };

        expandPathToNode(nodes, currentSearchMatchId);
      }

      // If there's a focused node, expand to show its children
      if (focusedNodeId && nodes.length > 0) {
        const rootNode = nodes[0];

        // Check if focusedNodeId is a label-based search
        const isLabelSearch = focusedNodeId.startsWith('label:');
        const searchLabel = isLabelSearch ? focusedNodeId.substring(6) : undefined;

        // Always expand the root to show the focused node
        if (rootNode.hasChildren) {
          baseExpanded['0'] = true;
        }

        // If the root is the parent (not the focused node itself), also expand the focused node
        const isRootTheFocusedNode = isLabelSearch
          ? rootNode.label === searchLabel
          : rootNode.id === focusedNodeId;

        if (!isRootTheFocusedNode && rootNode.hasChildren) {
          // The focused node is at "0.0" (first child of parent)
          baseExpanded['0.0'] = true;
        }
      }

      // If in callers mode, expand to show the target node
      if (callersNodeLabel && callersNode && nodes.length > 0) {
        // Find path from root to target node and expand all nodes along the path
        const expandPathToNode = (nodes: CallTreeNode[], targetId: string): boolean => {
          for (const node of nodes) {
            if (node.id === targetId) {
              // Found the target - don't expand it yet, but confirm path
              return true;
            }
            if (node.subRows && node.hasChildren) {
              // Check if target is in this subtree
              const foundInSubtree = expandPathToNode(node.subRows, targetId);
              if (foundInSubtree) {
                // Target is in this subtree, so expand this node
                baseExpanded[node.id] = true;
                return true;
              }
            }
          }
          return false;
        };

        // Expand path to target
        expandPathToNode(nodes, callersNode.id);

        // Also expand the target node itself to show its immediate callers (children in this view)
        if (callersNode.hasChildren) {
          baseExpanded[callersNode.id] = true;
        }
      }

      // If there's a highlighted node (from flame graph focus), expand path to show it
      if (highlightedNodeId) {
        const expandPathToHighlightedNode = (nodes: CallTreeNode[], targetId: string): boolean => {
          for (const node of nodes) {
            if (node.id === targetId) {
              return true;
            }
            if (node.subRows && node.hasChildren) {
              const foundInSubtree = expandPathToHighlightedNode(node.subRows, targetId);
              if (foundInSubtree) {
                baseExpanded[node.id] = true;
                return true;
              }
            }
          }
          return false;
        };

        expandPathToHighlightedNode(nodes, highlightedNodeId);
      }

      return baseExpanded;
    }, [nodes, focusedNodeId, callersNodeLabel, callersNode, currentSearchMatchId, highlightedNodeId]);

    // Define columns
    const columns = useMemo<Column<CallTreeNode>[]>(() => {
      if (data.isDiffFlamegraph()) {
        const cols: Column<CallTreeNode>[] = [
          {
            Header: '',
            id: 'actions',
            Cell: ({ row }: any) => (
              <ActionsCell
                row={row}
                onFocus={handleSetFocusMode}
                onShowCallers={handleSetCallersMode}
                onSearch={onSearch}
                focusedNodeId={focusedNodeId}
                callersNodeLabel={callersNodeLabel}
                styles={styles}
                searchNodes={searchNodes}
              />
            ),
            width: onSearch ? 75 : 50,
            minWidth: onSearch ? 75 : 50,
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
                onSymbolClick={onSymbolClick}
                styles={styles}
                allNodes={nodes}
                compact={compact}
                toggleRowExpanded={tableInstance.toggleRowExpanded}
              />
            ),
            minWidth: 200,
            width: undefined,
          },
        ];

        if (!compact) {
          cols.push({
            Header: '',
            id: 'colorBar',
            Cell: ({ row }: { row: Row<CallTreeNode> }) => (
              <ColorBarCell node={row.original} data={data} colorScheme={colorScheme} theme={theme} styles={styles} focusedNode={focusedNode} callersNode={callersNode} />
            ),
            minWidth: 200,
            width: 200,
            disableSortBy: true,
          });
        }

        cols.push(
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
          }
        );

        return cols;
      } else {
        const cols: Column<CallTreeNode>[] = [
          {
            Header: '',
            id: 'actions',
            Cell: ({ row }: any) => (
              <ActionsCell
                row={row}
                onFocus={handleSetFocusMode}
                onShowCallers={handleSetCallersMode}
                onSearch={onSearch}
                focusedNodeId={focusedNodeId}
                callersNodeLabel={callersNodeLabel}
                styles={styles}
                searchNodes={searchNodes}
              />
            ),
            width: onSearch ? 75 : 50,
            minWidth: onSearch ? 75 : 50,
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
                onSymbolClick={onSymbolClick}
                styles={styles}
                allNodes={nodes}
                compact={compact}
                toggleRowExpanded={tableInstance.toggleRowExpanded}
              />
            ),
            minWidth: 200,
            width: undefined,
          },
        ];

        if (!compact) {
          cols.push(
            {
              Header: '',
              id: 'colorBar',
              Cell: ({ row }: { row: Row<CallTreeNode> }) => (
                <ColorBarCell node={row.original} data={data} colorScheme={colorScheme} theme={theme} styles={styles} focusedNode={focusedNode} callersNode={callersNode} />
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
            }
          );
        }

        cols.push({
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
        });

        return cols;
      }
    }, [data, onSymbolClick, colorScheme, theme, styles, focusedNode, callersNode, callersNodeLabel, compact]);

    // toggleRowExpanded is used in the Cell renderers but doesn't need to be in the dependencies
    // because it's accessed at render time, not definition time

    // Create a stable nodes reference that changes when search match changes
    // This triggers autoResetExpanded in the table
    const tableNodes = useMemo(() => {
      // Return a shallow copy to force reference change
      return [...nodes];
    }, [nodes, currentSearchMatchId, highlightedNodeId]);

    // Setup table instance with expand and sort
    // Using autoResetExpanded: true so expansion resets when data changes
    const tableInstance = useTable<CallTreeNode>(
      {
        columns,
        data: tableNodes,
        getSubRows: (row) => row.subRows || [],
        initialState: {
          sortBy: [{ id: 'total', desc: true }],
          expanded: calculatedExpanded,
        },
        autoResetExpanded: true, // Reset to initialState when data changes
        autoResetSortBy: false,
      },
      useSortBy,
      useExpanded
    );

    const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = tableInstance;

    return (
      <div className={styles.container} data-testid="callTree">
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {searchQuery && (
              <div className={styles.searchContainer}>
                {searchNodes.length > 0 && (
                  <div className={styles.searchNavigation}>
                    <span className={styles.searchCounter}>
                      {currentMatchIndex + 1} of {searchNodes.length}
                      {searchNodes.length >= 50 && '+'}
                    </span>
                    <Button
                      icon="angle-up"
                      fill="text"
                      size="sm"
                      onClick={navigateToPrevMatch}
                      tooltip="Previous match"
                      aria-label="Previous match"
                    />
                    <Button
                      icon="angle-down"
                      fill="text"
                      size="sm"
                      onClick={navigateToNextMatch}
                      tooltip="Next match"
                      aria-label="Next match"
                    />
                  </div>
                )}
                {searchQuery && searchNodes.length === 0 && !searchError && (
                  <span className={styles.searchNoResults}>No matches found</span>
                )}
                {searchError && <span className={styles.searchError}>{searchError}</span>}
              </div>
            )}
          </div>

          {focusedNode && (
            <Tooltip content={focusedNode.label} placement="top">
              <div className={styles.focusedItem}>
                <Icon size="sm" name="compress-arrows" />
                <span className={styles.focusedItemLabel}>
                  {focusedNode.label.substring(focusedNode.label.lastIndexOf('/') + 1)}
                </span>
                <IconButton
                  className={styles.modePillCloseButton}
                  name="times"
                  size="sm"
                  onClick={() => handleSetFocusMode(undefined)}
                  tooltip="Clear callees view"
                  aria-label="Clear callees view"
                />
              </div>
            </Tooltip>
          )}

          {callersNode && (
            <Tooltip content={callersNodeLabel || ''} placement="top">
              <div className={styles.callersItem}>
                <Icon size="sm" name="gf-show-context" />
                <span className={styles.callersItemLabel}>
                  {(callersNodeLabel || '').substring((callersNodeLabel || '').lastIndexOf('/') + 1)}
                </span>
                <IconButton
                  className={styles.modePillCloseButton}
                  name="times"
                  size="sm"
                  onClick={() => handleSetCallersMode(undefined)}
                  tooltip="Clear callers view"
                  aria-label="Clear callers view"
                />
              </div>
            </Tooltip>
          )}

          <div className={styles.toolbarRight}>
          </div>
        </div>

        <AutoSizer style={{ width: '100%', height: 'calc(100% - 50px)' }}>
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
                      const isFocusedRow = row.original.id === focusedNodeId;
                      const isCallersTargetRow = callersNodeLabel && row.original.label === callersNodeLabel;
                      const isSearchMatchRow = currentSearchMatchId && row.original.id === currentSearchMatchId;
                      const isHighlightedRow = highlightedNodeId && row.original.id === highlightedNodeId;

                      // Determine which ref to use - prioritize search match, then highlighted
                      const rowRef = isSearchMatchRow ? searchMatchRowRef : isHighlightedRow ? highlightedRowRef : null;

                      return (
                        <tr
                          key={key}
                          {...rowProps}
                          ref={rowRef}
                          className={cx(
                            styles.tr,
                            (isFocusedRow || (focusedNodeId?.startsWith('label:') && focusedNodeId.substring(6) === row.original.label)) && styles.focusedRow,
                            isCallersTargetRow && styles.callersTargetRow,
                            isSearchMatchRow && styles.searchMatchRow,
                            isHighlightedRow && !isSearchMatchRow && styles.highlightedRow
                          )}
                        >
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
  onShowCallers,
  onSearch,
  focusedNodeId,
  callersNodeLabel,
  styles,
  searchNodes,
}: {
  row: Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>;
  onFocus: (nodeIdOrLabel: string, isLabel?: boolean) => void;
  onShowCallers: (label: string) => void;
  onSearch?: (symbol: string) => void;
  focusedNodeId: string | undefined;
  callersNodeLabel: string | undefined;
  styles: any;
  searchNodes?: string[];
}) {
  const hasChildren = row.original.hasChildren;
  const isTheFocusedNode = row.original.id === focusedNodeId ||
                           (focusedNodeId?.startsWith('label:') && focusedNodeId.substring(6) === row.original.label);
  const isTheCallersTarget = row.original.label === callersNodeLabel;
  const inCallersMode = callersNodeLabel !== undefined;
  const inFocusMode = focusedNodeId !== undefined;
  const isRootNode = row.original.depth === 0 && !row.original.parentId;
  const isSearchMatch = searchNodes?.includes(row.original.id) ?? false;

  // Show focus button if:
  // - Node has children AND
  // - Node is not the currently focused node AND
  // - If it's the root node, only show when in focus mode (as parent)
  // Allow switching from callers mode to focus mode
  const shouldShowFocusButton = hasChildren && !isTheFocusedNode && !(isRootNode && !inFocusMode);

  // Show callers button if:
  // - Node is not the current callers target AND
  // - Node is not the root node
  // Allow switching from focus mode to callers mode
  const shouldShowCallersButton = !isTheCallersTarget && !isRootNode;

  return (
    <div className={styles.actionsCell}>
      <div className={styles.actionButtonSlot}>
        {shouldShowFocusButton ? (
          <Button
            icon="compress-arrows"
            fill="text"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // When in callers mode, switch by label; otherwise use ID
              if (inCallersMode) {
                onFocus(row.original.label, true);
              } else {
                onFocus(row.original.id, false);
              }
            }}
            tooltip="Show callees of this function"
            aria-label="Show callees"
            className={styles.actionButton}
          />
        ) : (
          <div className={styles.actionButtonPlaceholder} />
        )}
      </div>
      <div className={styles.actionButtonSlot}>
        {shouldShowCallersButton ? (
          <Button
            icon="expand-arrows-alt"
            fill="text"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onShowCallers(row.original.label);
            }}
            tooltip="Show callers of this function"
            aria-label="Show callers"
            className={styles.actionButton}
          />
        ) : (
          <div className={styles.actionButtonPlaceholder} />
        )}
      </div>
      {onSearch && !isSearchMatch && (
        <div className={styles.actionButtonSlot}>
          <Button
            icon="search"
            fill="text"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSearch(row.original.label);
            }}
            tooltip="Search for this function"
            aria-label="Search"
            className={styles.actionButton}
          />
        </div>
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
  onSymbolClick,
  styles,
  allNodes,
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
  styles: any;
  allNodes: CallTreeNode[];
  compact?: boolean;
  toggleRowExpanded: (id: string[], value?: boolean) => void;
}) {
  const expandSingleChildChain = (node: CallTreeNode) => {
    if (node.childCount === 1 && node.subRows && node.subRows.length === 1) {
      const childNode = node.subRows[0];
      toggleRowExpanded([childNode.id], true);
      if (childNode.hasChildren) {
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
    <div className={styles.functionCellContainer}>
      {connector && <span className={styles.treeConnector}>{connector} </span>}
      <Button fill="text" size="sm" onClick={handleClick} className={styles.functionButton}>
        {value}
      </Button>
      {!compact && row.original.childCount > 0 && (
        <span className={styles.nodeBadge}>
          {row.original.childCount} {row.original.childCount === 1 ? 'child' : 'children'}, {row.original.subtreeSize} {row.original.subtreeSize === 1 ? 'node' : 'nodes'}
        </span>
      )}
    </div>
  );
}


function ColorBarCell({
  node,
  data,
  colorScheme,
  theme,
  styles,
  focusedNode,
  callersNode,
}: {
  node: CallTreeNode;
  data: FlameGraphDataContainer;
  colorScheme: ColorScheme | ColorSchemeDiff;
  theme: GrafanaTheme2;
  styles: any;
  focusedNode?: CallTreeNode;
  callersNode?: CallTreeNode;
}) {
  const barColor = getRowBackgroundColor(node, data, colorScheme, theme);

  // Calculate bar width
  let barWidth: string;

  if (focusedNode) {
    // In focused state - scale bars relative to focused node
    if (node.id === focusedNode.parentId) {
      // This is the parent node - skip the bar
      barWidth = '0%';
    } else {
      // Scale relative to the focused node's total
      const relativePercent = focusedNode.total > 0 ? (node.total / focusedNode.total) * 100 : 0;
      barWidth = `${Math.min(relativePercent, 100)}%`;
    }
  } else {
    // Not in focused state (normal mode or callers mode) - use the original percentage
    // In callers mode, we keep original scaling to show relative impact of different caller paths
    barWidth = `${Math.min(node.totalPercent, 100)}%`;
  }

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
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    toolbarRight: css({
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    }),
    searchContainer: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flexWrap: 'wrap',
    }),
    searchNavigation: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: `0 ${theme.spacing(1)}`,
    }),
    searchCounter: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
    }),
    searchNoResults: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
    searchError: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.error.text,
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
    focusedRow: css({
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.08),
      borderLeft: `3px solid ${theme.colors.primary.main}`,
      fontWeight: theme.typography.fontWeightMedium,
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.1),
      },
    }),
    callersTargetRow: css({
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.08),
      borderLeft: `3px solid ${theme.colors.info.main}`,
      fontWeight: theme.typography.fontWeightMedium,
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.1),
      },
    }),
    searchMatchRow: css({
      backgroundColor: theme.colors.warning.transparent,
      borderLeft: `3px solid ${theme.colors.warning.main}`,
      fontWeight: theme.typography.fontWeightMedium,
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.warning.transparent, 0.1),
      },
    }),
    highlightedRow: css({
      backgroundColor: theme.colors.primary.transparent,
      borderLeft: `3px solid ${theme.colors.primary.main}`,
      fontWeight: theme.typography.fontWeightMedium,
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.primary.transparent, 0.1),
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
    nodeBadge: css({
      marginLeft: theme.spacing(1),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
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
      justifyContent: 'flex-end',
      gap: theme.spacing(0.5),
      height: '20px',
      minWidth: '60px', // Fixed width to ensure consistent alignment (72px when search button is present)
    }),
    actionButtonSlot: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px', // Fixed width for each button slot
      height: '20px',
    }),
    actionButtonPlaceholder: css({
      width: '24px',
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
    // Pill style matching FlameGraphMetadata
    modePill: css({
      display: 'inline-flex',
      alignItems: 'center',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(8),
      padding: theme.spacing(0.5, 1),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: theme.colors.text.secondary,
    }),
    modePillLabel: css({
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      marginLeft: theme.spacing(0.5),
    }),
    modePillCloseButton: css({
      verticalAlign: 'text-bottom',
      margin: theme.spacing(0, 0.5),
    }),
    // Keep old names as aliases for backwards compatibility
    focusedItem: css({
      display: 'inline-flex',
      alignItems: 'center',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(8),
      padding: theme.spacing(0.5, 1),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: theme.colors.text.secondary,
    }),
    focusedItemLabel: css({
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      marginLeft: theme.spacing(0.5),
    }),
    callersItem: css({
      display: 'inline-flex',
      alignItems: 'center',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(8),
      padding: theme.spacing(0.5, 1),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: theme.colors.text.secondary,
    }),
    callersItemLabel: css({
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      marginLeft: theme.spacing(0.5),
    }),
  };
}

export default FlameGraphCallTreeContainer;
