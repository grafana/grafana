import { css, cx } from '@emotion/css';
import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useTable, useSortBy, useExpanded, Column, Row, UseExpandedRowProps } from 'react-table';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, Icon, IconButton, Menu, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';

import { getBarColorByDiff, getBarColorByPackage, getBarColorByValue } from '../FlameGraph/colors';
import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { ColorScheme, ColorSchemeDiff } from '../types';

import { buildAllCallTreeNodes, buildCallersTree, CallTreeNode, getInitialExpandedState } from './utils';

type Styles = ReturnType<typeof getStyles>;

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
  /** Item indexes of the focused item in the flame graph, to set focus in the call tree */
  highlightedItemIndexes?: number[];
};

const FlameGraphCallTreeContainer = memo(
  ({
    data,
    onSymbolClick,
    sandwichItem,
    onSandwich,
    onTableSort,
    colorScheme: initialColorScheme,
    search,
    compact: compactProp,
    onSearch,
    highlightedItemIndexes,
  }: Props) => {
    const [isCompact, setIsCompact] = useState(false);
    const widthRef = useRef(0);
    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    const searchMatchRowRef = useRef<HTMLTableRowElement | null>(null);

    const colorScheme = data.isDiffFlamegraph() ? ColorSchemeDiff.Default : ColorScheme.PackageBased;

    const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(undefined);
    const [callersNodeLabel, setCallersNodeLabel] = useState<string | undefined>(undefined);

    useEffect(() => {
      if (sandwichItem !== undefined) {
        setCallersNodeLabel(sandwichItem);
        setFocusedNodeId(undefined);
      } else {
        setCallersNodeLabel(undefined);
      }
    }, [sandwichItem]);

    const searchQuery = search;
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
    const [searchError, setSearchError] = useState<string | undefined>(undefined);

    const handleSetFocusMode = useCallback((nodeIdOrLabel: string | undefined, isLabel = false) => {
      if (nodeIdOrLabel === undefined) {
        setFocusedNodeId(undefined);
      } else if (isLabel) {
        // When switching from callers mode, we need to find the node by label in the normal tree
        setFocusedNodeId(`label:${nodeIdOrLabel}`);
      } else {
        setFocusedNodeId(nodeIdOrLabel);
      }

      if (nodeIdOrLabel !== undefined) {
        setCallersNodeLabel(undefined);
      }
    }, []);

    const handleSetCallersMode = useCallback((label: string | undefined) => {
      setCallersNodeLabel(label);
      if (label !== undefined) {
        setFocusedNodeId(undefined);
      }
    }, []);

    const { nodes, focusedNode, callersNode } = useMemo(() => {
      const allNodes = buildAllCallTreeNodes(data);

      let nodesToUse = allNodes;
      let focused: CallTreeNode | undefined;
      let callersTargetNode: CallTreeNode | undefined;

      if (focusedNodeId) {
        const isLabelSearch = focusedNodeId.startsWith('label:');
        const searchKey = isLabelSearch ? focusedNodeId.substring(6) : focusedNodeId;

        const findNode = (nodes: CallTreeNode[], searchKey: string, byLabel: boolean): CallTreeNode | undefined => {
          for (const node of nodes) {
            if (byLabel ? node.label === searchKey : node.id === searchKey) {
              return node;
            }
            if (node.subRows) {
              const found = findNode(node.subRows, searchKey, byLabel);
              if (found) {
                return found;
              }
            }
          }
          return undefined;
        };

        focused = findNode(allNodes, searchKey, isLabelSearch);
        if (focused) {
          if (isLabelSearch) {
            // Update asynchronously to avoid updating state during render
            setTimeout(() => setFocusedNodeId(focused!.id), 0);
          }

          if (focused.parentId) {
            const parent = findNode(allNodes, focused.parentId, false);
            if (parent) {
              const modifiedParent: CallTreeNode = {
                ...parent,
                subRows: [focused],
                hasChildren: true,
                childCount: 1,
              };
              nodesToUse = [modifiedParent];
            } else {
              nodesToUse = [focused];
            }
          } else {
            nodesToUse = [focused];
          }
        }
      }

      if (callersNodeLabel) {
        const [callers, _] = data.getSandwichLevels(callersNodeLabel);

        if (callers.length > 0) {
          // Build callers tree - follows same pattern as flame graph sandwich mode
          // Percentages are relative to target (target = 100%)
          const tree = buildCallersTree(callers, data);

          nodesToUse = tree;
          // The first node in the tree is the target function
          callersTargetNode = tree.length > 0 ? tree[0] : undefined;
        } else {
          nodesToUse = [];
          callersTargetNode = undefined;
        }
      }

      return { nodes: nodesToUse, focusedNode: focused, callersNode: callersTargetNode };
    }, [data, focusedNodeId, callersNodeLabel]);

    // Calculate depth offset for focus mode - the top-most visible node should appear at depth 0
    const depthOffset = useMemo(() => {
      if (focusedNodeId && nodes.length > 0) {
        return nodes[0].depth;
      }
      return 0;
    }, [focusedNodeId, nodes]);

    const searchNodes = useMemo(() => {
      if (!searchQuery.trim()) {
        return [];
      }

      const MAX_MATCHES = 50;
      const matches: Array<{ id: string; total: number }> = [];

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

      const search = (nodesToSearch: CallTreeNode[]) => {
        for (const node of nodesToSearch) {
          if (matches.length >= MAX_MATCHES) {
            break;
          }

          let isMatch = false;
          if (searchRegex) {
            isMatch = searchRegex.test(node.label);
          } else {
            isMatch = node.label.toLowerCase().includes(searchQuery.toLowerCase());
          }

          if (isMatch) {
            matches.push({ id: node.id, total: node.total });
          }

          if (node.subRows && matches.length < MAX_MATCHES) {
            search(node.subRows);
          }
        }
      };

      search(nodes);

      // Sort by total time descending so most significant matches appear first
      matches.sort((a, b) => b.total - a.total);

      const matchIds = matches.map((m) => m.id);

      setSearchError(undefined);
      return matchIds;
    }, [searchQuery, nodes]);

    // When highlightedItemIndexes changes (from flame graph focus), set focus mode in the call tree
    useEffect(() => {
      if (!highlightedItemIndexes || highlightedItemIndexes.length === 0) {
        setFocusedNodeId(undefined);
        return;
      }

      const itemIndexesMatch = (a: number[], b: number[]): boolean => {
        if (a.length !== b.length) {
          return false;
        }
        return a.every((val, idx) => val === b[idx]);
      };

      const findExactMatch = (nodesToSearch: CallTreeNode[]): string | undefined => {
        for (const node of nodesToSearch) {
          if (itemIndexesMatch(node.levelItem.itemIndexes, highlightedItemIndexes)) {
            return node.id;
          }
          if (node.subRows) {
            const found = findExactMatch(node.subRows);
            if (found) {
              return found;
            }
          }
        }
        return undefined;
      };

      // Need to search in the full tree, not the potentially filtered nodes
      const allNodes = buildAllCallTreeNodes(data);
      const matchedNodeId = findExactMatch(allNodes);
      if (matchedNodeId) {
        setFocusedNodeId(matchedNodeId);
      }
    }, [highlightedItemIndexes, data]);

    const searchResultKey = searchNodes.join(',');
    useEffect(() => {
      setCurrentMatchIndex(searchNodes.length > 0 ? 0 : -1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchResultKey]);

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

    const currentSearchMatchId = useMemo(() => {
      if (searchNodes.length > 0 && currentMatchIndex >= 0 && currentMatchIndex < searchNodes.length) {
        return searchNodes[currentMatchIndex];
      }
      return undefined;
    }, [searchNodes, currentMatchIndex]);

    useEffect(() => {
      if (searchMatchRowRef.current) {
        searchMatchRowRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, [currentMatchIndex, currentSearchMatchId]);

    const calculatedExpanded = useMemo(() => {
      const baseExpanded = getInitialExpandedState(nodes, 1);

      if (currentSearchMatchId) {
        const expandPathToNode = (nodes: CallTreeNode[], targetId: string): boolean => {
          for (const node of nodes) {
            if (node.id === targetId) {
              return true;
            }
            if (node.subRows && node.hasChildren) {
              const foundInSubtree = expandPathToNode(node.subRows, targetId);
              if (foundInSubtree) {
                baseExpanded[node.id] = true;
                return true;
              }
            }
          }
          return false;
        };

        expandPathToNode(nodes, currentSearchMatchId);
      }

      if (focusedNodeId && nodes.length > 0) {
        const rootNode = nodes[0];

        const isLabelSearch = focusedNodeId.startsWith('label:');
        const searchLabel = isLabelSearch ? focusedNodeId.substring(6) : undefined;

        if (rootNode.hasChildren) {
          baseExpanded['0'] = true;
        }

        const isRootTheFocusedNode = isLabelSearch ? rootNode.label === searchLabel : rootNode.id === focusedNodeId;

        if (!isRootTheFocusedNode && rootNode.hasChildren) {
          baseExpanded['0.0'] = true;
        }
      }

      if (callersNodeLabel && callersNode && nodes.length > 0) {
        const expandPathToNode = (nodes: CallTreeNode[], targetId: string): boolean => {
          for (const node of nodes) {
            if (node.id === targetId) {
              return true;
            }
            if (node.subRows && node.hasChildren) {
              const foundInSubtree = expandPathToNode(node.subRows, targetId);
              if (foundInSubtree) {
                baseExpanded[node.id] = true;
                return true;
              }
            }
          }
          return false;
        };

        expandPathToNode(nodes, callersNode.id);

        if (callersNode.hasChildren) {
          baseExpanded[callersNode.id] = true;
        }
      }

      return baseExpanded;
    }, [nodes, focusedNodeId, callersNodeLabel, callersNode, currentSearchMatchId]);

    const ACTIONS_WIDTH = 30;
    const COLOR_BAR_WIDTH = 200;
    const SELF_WIDTH = 150;
    const TOTAL_WIDTH = 150;
    const BASELINE_WIDTH = 100;
    const COMPARISON_WIDTH = 100;
    const DIFF_WIDTH = 100;
    // Threshold high enough to ensure function names are readable in non-compact mode
    const FUNCTION_COMPACT_THRESHOLD = 550;
    const FUNCTION_MIN_WIDTH = 100;

    const minNonCompactWidth = useMemo(() => {
      let fixedColumnsWidth: number;
      if (data.isDiffFlamegraph()) {
        fixedColumnsWidth = ACTIONS_WIDTH + COLOR_BAR_WIDTH + BASELINE_WIDTH + COMPARISON_WIDTH + DIFF_WIDTH;
      } else {
        fixedColumnsWidth = ACTIONS_WIDTH + COLOR_BAR_WIDTH + SELF_WIDTH + TOTAL_WIDTH;
      }
      return fixedColumnsWidth + FUNCTION_COMPACT_THRESHOLD;
    }, [data, ACTIONS_WIDTH]);

    const compact = compactProp !== undefined ? compactProp : isCompact;

    const calculateFunctionColumnWidth = useCallback(
      (width: number, compactMode: boolean) => {
        if (width <= 0) {
          return undefined;
        }

        let fixedColumnsWidth: number;
        if (compactMode) {
          if (data.isDiffFlamegraph()) {
            fixedColumnsWidth = ACTIONS_WIDTH + BASELINE_WIDTH + COMPARISON_WIDTH + DIFF_WIDTH;
          } else {
            fixedColumnsWidth = ACTIONS_WIDTH + TOTAL_WIDTH;
          }
        } else {
          if (data.isDiffFlamegraph()) {
            fixedColumnsWidth = ACTIONS_WIDTH + COLOR_BAR_WIDTH + BASELINE_WIDTH + COMPARISON_WIDTH + DIFF_WIDTH;
          } else {
            fixedColumnsWidth = ACTIONS_WIDTH + COLOR_BAR_WIDTH + SELF_WIDTH + TOTAL_WIDTH;
          }
        }
        return Math.max(width - fixedColumnsWidth, FUNCTION_MIN_WIDTH);
      },
      [data, ACTIONS_WIDTH]
    );

    const columns = useMemo<Array<Column<CallTreeNode>>>(() => {
      if (data.isDiffFlamegraph()) {
        const cols: Array<Column<CallTreeNode>> = [
          {
            Header: '',
            id: 'actions',
            Cell: ({ row }: { row: Row<CallTreeNode> }) => (
              <ActionsCell
                nodeId={row.original.id}
                label={row.original.label}
                hasChildren={row.original.hasChildren}
                depth={row.original.depth - depthOffset}
                parentId={row.original.parentId}
                onFocus={handleSetFocusMode}
                onShowCallers={handleSetCallersMode}
                onSearch={onSearch}
                focusedNodeId={focusedNodeId}
                callersNodeLabel={callersNodeLabel}
                isSearchMatch={searchNodes?.includes(row.original.id) ?? false}
                actionsCellClass={styles.actionsCell}
              />
            ),
            width: ACTIONS_WIDTH,
            minWidth: ACTIONS_WIDTH,
            disableSortBy: true,
          },
          {
            Header: 'Function',
            accessor: 'label',
            Cell: ({ row, value, rowIndex }: { row: Row<CallTreeNode>; value: string; rowIndex?: number }) => (
              <FunctionCellWithExpander
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                row={row as Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>}
                value={value}
                depth={row.original.depth - depthOffset}
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
            minWidth: FUNCTION_MIN_WIDTH,
            // width is applied dynamically in render to avoid re-creating columns on resize
          },
        ];

        if (!compact) {
          cols.push({
            Header: '',
            id: 'colorBar',
            Cell: ({ row }: { row: Row<CallTreeNode> }) => (
              <ColorBarCell
                node={row.original}
                data={data}
                colorScheme={colorScheme}
                theme={theme}
                styles={styles}
                focusedNode={focusedNode}
                callersNode={callersNode}
              />
            ),
            minWidth: COLOR_BAR_WIDTH,
            width: COLOR_BAR_WIDTH,
            disableSortBy: true,
          });
        }

        cols.push(
          {
            Header: 'Baseline %',
            accessor: 'selfPercent',
            Cell: ({ value }: { value: number }) => `${value.toFixed(2)}%`,
            sortType: 'basic',
            width: BASELINE_WIDTH,
            minWidth: BASELINE_WIDTH,
          },
          {
            Header: 'Comparison %',
            accessor: 'selfPercentRight',
            Cell: ({ value }: { value: number | undefined }) => (value !== undefined ? `${value.toFixed(2)}%` : '-'),
            sortType: 'basic',
            width: COMPARISON_WIDTH,
            minWidth: COMPARISON_WIDTH,
          },
          {
            Header: 'Diff %',
            accessor: 'diffPercent',
            Cell: ({ value }: { value: number | undefined }) => (
              <DiffCell value={value} colorScheme={colorScheme} theme={theme} styles={styles} />
            ),
            sortType: 'basic',
            width: DIFF_WIDTH,
            minWidth: DIFF_WIDTH,
          }
        );

        return cols;
      } else {
        const cols: Array<Column<CallTreeNode>> = [
          {
            Header: '',
            id: 'actions',
            Cell: ({ row }: { row: Row<CallTreeNode> }) => (
              <ActionsCell
                nodeId={row.original.id}
                label={row.original.label}
                hasChildren={row.original.hasChildren}
                depth={row.original.depth - depthOffset}
                parentId={row.original.parentId}
                onFocus={handleSetFocusMode}
                onShowCallers={handleSetCallersMode}
                onSearch={onSearch}
                focusedNodeId={focusedNodeId}
                callersNodeLabel={callersNodeLabel}
                isSearchMatch={searchNodes?.includes(row.original.id) ?? false}
                actionsCellClass={styles.actionsCell}
              />
            ),
            width: ACTIONS_WIDTH,
            minWidth: ACTIONS_WIDTH,
            disableSortBy: true,
          },
          {
            Header: 'Function',
            accessor: 'label',
            Cell: ({ row, value, rowIndex }: { row: Row<CallTreeNode>; value: string; rowIndex?: number }) => (
              <FunctionCellWithExpander
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                row={row as Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>}
                value={value}
                depth={row.original.depth - depthOffset}
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
            minWidth: FUNCTION_MIN_WIDTH,
            // width is applied dynamically in render to avoid re-creating columns on resize
          },
        ];

        if (!compact) {
          cols.push(
            {
              Header: '',
              id: 'colorBar',
              Cell: ({ row }: { row: Row<CallTreeNode> }) => (
                <ColorBarCell
                  node={row.original}
                  data={data}
                  colorScheme={colorScheme}
                  theme={theme}
                  styles={styles}
                  focusedNode={focusedNode}
                  callersNode={callersNode}
                />
              ),
              minWidth: COLOR_BAR_WIDTH,
              width: COLOR_BAR_WIDTH,
              disableSortBy: true,
            },
            {
              Header: 'Self',
              accessor: 'self',
              Cell: ({ row }: { row: Row<CallTreeNode> }) => {
                // Use the pre-computed self value which sums across all merged itemIndexes
                const displaySelf = data.valueDisplayProcessor(row.original.self);
                const formattedValue = displaySelf.suffix ? displaySelf.text + displaySelf.suffix : displaySelf.text;
                return (
                  <div className={styles.valueCell}>
                    <span className={styles.valueNumber}>{formattedValue}</span>
                    <span className={styles.percentNumber}>{row.original.selfPercent.toFixed(2)}%</span>
                  </div>
                );
              },
              sortType: 'basic',
              minWidth: SELF_WIDTH,
              width: SELF_WIDTH,
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
          minWidth: TOTAL_WIDTH,
          width: TOTAL_WIDTH,
        });

        return cols;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      data,
      onSymbolClick,
      colorScheme,
      theme,
      styles,
      focusedNode,
      callersNode,
      focusedNodeId,
      callersNodeLabel,
      searchNodes,
      onSearch,
      compact,
      ACTIONS_WIDTH,
      handleSetFocusMode,
      handleSetCallersMode,
    ]);
    // Note: nodes, tableInstance.rows, tableInstance.toggleRowExpanded are intentionally excluded
    // as toggleRowExpanded is accessed at render time, not definition time

    // tableNodes changes reference when search/highlight changes to trigger autoResetExpanded
    const tableNodes = useMemo(() => {
      return [...nodes];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, currentSearchMatchId]);
    // Note: currentSearchMatchId is intentionally included to force re-render

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
                <Icon size="sm" name="expand-arrows-alt" />
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

          <div className={styles.toolbarRight}></div>
        </div>

        <AutoSizer style={{ width: '100%', height: 'calc(100% - 50px)' }}>
          {({ width, height }) => {
            const SCROLLBAR_WIDTH = 16;
            const availableWidth = width - SCROLLBAR_WIDTH;

            // Only update compact mode when crossing the threshold to avoid re-renders on every resize
            if (compactProp === undefined) {
              const shouldBeCompact = availableWidth > 0 && availableWidth < minNonCompactWidth;
              if (shouldBeCompact !== isCompact) {
                queueMicrotask(() => setIsCompact(shouldBeCompact));
              }
            }
            widthRef.current = width;

            const functionColumnWidth = calculateFunctionColumnWidth(availableWidth, compact);

            if (width < 3 || height < 3) {
              return null;
            }

            return (
              <div style={{ width, height, display: 'flex', flexDirection: 'column' }}>
                {/* Fixed header table */}
                <table {...getTableProps()} className={styles.table} style={{ flexShrink: 0 }}>
                  <thead className={styles.thead}>
                    {headerGroups.map((headerGroup) => {
                      const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
                      return (
                        <tr key={key} {...headerGroupProps}>
                          {headerGroup.headers.map((column) => {
                            const { key: headerKey, ...headerProps } = column.getHeaderProps(
                              column.getSortByToggleProps()
                            );
                            const columnWidth = column.id === 'label' ? functionColumnWidth : column.width;
                            return (
                              <th
                                key={headerKey}
                                {...headerProps}
                                className={styles.th}
                                style={{
                                  ...(columnWidth !== undefined && { width: columnWidth }),
                                  textAlign: column.id === 'self' || column.id === 'total' ? 'right' : undefined,
                                  ...(column.minWidth !== undefined && { minWidth: column.minWidth }),
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
                </table>
                {/* Scrollable body */}
                <div style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto' }} className={styles.scrollContainer}>
                  <table {...getTableProps()} className={styles.table}>
                    <tbody {...getTableBodyProps()} className={styles.tbody}>
                      {rows.map((row, rowIndex) => {
                        prepareRow(row);
                        const { key, ...rowProps } = row.getRowProps();
                        const isFocusedRow = row.original.id === focusedNodeId;
                        const isCallersTargetRow = callersNodeLabel && row.original.label === callersNodeLabel;
                        const isSearchMatchRow = currentSearchMatchId && row.original.id === currentSearchMatchId;

                        return (
                          <tr
                            key={key}
                            {...rowProps}
                            ref={isSearchMatchRow ? searchMatchRowRef : null}
                            className={cx(
                              styles.tr,
                              (isFocusedRow ||
                                (focusedNodeId?.startsWith('label:') &&
                                  focusedNodeId.substring(6) === row.original.label)) &&
                                styles.focusedRow,
                              isCallersTargetRow && styles.callersTargetRow,
                              isSearchMatchRow && styles.searchMatchRow
                            )}
                          >
                            {row.cells.map((cell) => {
                              const { key: cellKey, ...cellProps } = cell.getCellProps();
                              const isValueColumn = cell.column.id === 'self' || cell.column.id === 'total';
                              const isActionsColumn = cell.column.id === 'actions';
                              const columnWidth = cell.column.id === 'label' ? functionColumnWidth : cell.column.width;
                              return (
                                <td
                                  key={cellKey}
                                  {...cellProps}
                                  className={cx(
                                    styles.td,
                                    isActionsColumn && styles.actionsColumnCell,
                                    isValueColumn && styles.valueColumnCell
                                  )}
                                  style={{
                                    ...(columnWidth !== undefined && { width: columnWidth }),
                                    ...(cell.column.minWidth !== undefined && { minWidth: cell.column.minWidth }),
                                  }}
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
              </div>
            );
          }}
        </AutoSizer>
      </div>
    );
  }
);

FlameGraphCallTreeContainer.displayName = 'FlameGraphCallTreeContainer';

function getRowBackgroundColor(
  node: CallTreeNode,
  data: FlameGraphDataContainer,
  colorScheme: ColorScheme | ColorSchemeDiff,
  theme: GrafanaTheme2
): string {
  if (data.isDiffFlamegraph()) {
    const levels = data.getLevels();
    const rootTotal = levels[0][0].value;
    const rootTotalRight = levels[0][0].valueRight || 0;

    const barColor = getBarColorByDiff(
      node.total,
      node.totalRight || 0,
      rootTotal,
      rootTotalRight,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      colorScheme as ColorSchemeDiff
    );
    return barColor.setAlpha(1.0).toString();
  } else {
    if (colorScheme === ColorScheme.ValueBased) {
      const levels = data.getLevels();
      const rootTotal = levels[0][0].value;
      const barColor = getBarColorByValue(node.total, rootTotal, 0, 1);
      return barColor.setAlpha(1.0).toString();
    } else {
      const barColor = getBarColorByPackage(node.label, theme);
      return barColor.setAlpha(1.0).toString();
    }
  }
}

type ActionsCellProps = {
  nodeId: string;
  label: string;
  hasChildren: boolean;
  depth: number;
  parentId: string | undefined;
  onFocus: (nodeIdOrLabel: string, isLabel?: boolean) => void;
  onShowCallers: (label: string) => void;
  onSearch?: (symbol: string) => void;
  focusedNodeId: string | undefined;
  callersNodeLabel: string | undefined;
  isSearchMatch: boolean;
  actionsCellClass: string;
};

const ActionsCell = memo(function ActionsCell({
  nodeId,
  label,
  hasChildren,
  depth,
  parentId,
  onFocus,
  onShowCallers,
  onSearch,
  focusedNodeId,
  callersNodeLabel,
  isSearchMatch,
  actionsCellClass,
}: ActionsCellProps) {
  const isTheFocusedNode =
    nodeId === focusedNodeId || (focusedNodeId?.startsWith('label:') && focusedNodeId.substring(6) === label);
  const isTheCallersTarget = label === callersNodeLabel;
  const inCallersMode = callersNodeLabel !== undefined;
  const inFocusMode = focusedNodeId !== undefined;
  const isRootNode = depth === 0 && !parentId;

  const shouldShowFocusItem = hasChildren && !isTheFocusedNode && !(isRootNode && !inFocusMode);
  const shouldShowCallersItem = !isTheCallersTarget && !isRootNode;
  const shouldShowSearchItem = onSearch && !isSearchMatch;

  const hasAnyAction = shouldShowFocusItem || shouldShowCallersItem || shouldShowSearchItem;

  if (!hasAnyAction) {
    return <div className={actionsCellClass} />;
  }

  const menu = (
    <Menu>
      {shouldShowFocusItem && (
        <Menu.Item
          label="Focus on callees"
          icon="compress-arrows"
          onClick={() => {
            if (inCallersMode) {
              onFocus(label, true);
            } else {
              onFocus(nodeId, false);
            }
          }}
        />
      )}
      {shouldShowCallersItem && (
        <Menu.Item label="Show callers" icon="expand-arrows-alt" onClick={() => onShowCallers(label)} />
      )}
      {shouldShowSearchItem && <Menu.Item label="Search" icon="search" onClick={() => onSearch!(label)} />}
    </Menu>
  );

  return (
    <div className={actionsCellClass}>
      <Dropdown overlay={menu}>
        <IconButton name="ellipsis-v" aria-label="Actions" size="sm" onClick={(e) => e.stopPropagation()} />
      </Dropdown>
    </div>
  );
});

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
  styles: Styles;
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

    const ancestors: CallTreeNode[] = [];
    let currentNode = row.original;

    while (currentNode.parentId && currentNode.depth > 0) {
      const parent = nodeIdToNode.get(currentNode.parentId);
      if (parent) {
        ancestors.unshift(parent);
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
        {!compact && row.original.childCount > 0 && (
          <span className={styles.nodeBadge}>
            {row.original.childCount} {row.original.childCount === 1 ? 'child' : 'children'}, {row.original.subtreeSize}{' '}
            {row.original.subtreeSize === 1 ? 'node' : 'nodes'}
          </span>
        )}
      </span>
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
  styles: Styles;
  focusedNode?: CallTreeNode;
  callersNode?: CallTreeNode;
}) {
  const barColor = getRowBackgroundColor(node, data, colorScheme, theme);

  let barWidth: string;

  if (focusedNode) {
    if (node.id === focusedNode.parentId) {
      barWidth = '0%';
    } else {
      const relativePercent = focusedNode.total > 0 ? (node.total / focusedNode.total) * 100 : 0;
      barWidth = `${Math.min(relativePercent, 100)}%`;
    }
  } else {
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
  styles: Styles;
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

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.background.primary,
      display: 'flex',
      flexDirection: 'column',
    }),
    scrollContainer: css({
      '&::-webkit-scrollbar': {
        width: '8px',
      },
      '&::-webkit-scrollbar-track': {
        background: theme.colors.background.secondary,
      },
      '&::-webkit-scrollbar-thumb': {
        background: theme.colors.text.disabled,
        borderRadius: theme.shape.radius.default,
      },
      '&::-webkit-scrollbar-thumb:hover': {
        background: theme.colors.text.secondary,
      },
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
      tableLayout: 'fixed',
      borderCollapse: 'collapse',
      fontSize: theme.typography.fontSize,
      color: theme.colors.text.primary,
    }),
    thead: css({
      backgroundColor: theme.colors.background.secondary,
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
    td: css({
      padding: '0px 6px',
      borderBottom: 'none',
      height: '20px',
      verticalAlign: 'middle',
      overflow: 'hidden',
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
      whiteSpace: 'nowrap',
      minWidth: '60px',
    }),
    percentNumber: css({
      flex: '0 0 60px',
      width: '60px',
      textAlign: 'right',
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
    }),
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
      borderRadius: theme.shape.radius.default,
    }),
    actionsCell: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '20px',
    }),
    actionsColumnCell: css({
      backgroundColor: theme.colors.background.secondary,
      '&:hover': {
        backgroundColor: theme.colors.background.secondary,
      },
    }),
    valueColumnCell: css({
      overflow: 'visible',
      textAlign: 'right',
    }),
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
