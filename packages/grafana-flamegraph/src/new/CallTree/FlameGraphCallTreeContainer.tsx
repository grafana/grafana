/**
 * NEW FILE - FlameGraphCallTreeContainer is a new visualization introduced for the new UI.
 *
 * This component provides a tree-based view of the flame graph data, showing:
 * - Hierarchical call tree with expandable/collapsible nodes
 * - Self and total time percentages with visual bars
 * - Support for "callers" view (inverse call tree)
 * - Sorting by self/total time
 * - Search highlighting
 * - Focus and sandwich mode integration
 *
 * Uses react-table for the tree structure.
 */

import { css, cx } from '@emotion/css';
import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useTable, useSortBy, useExpanded, Column, Row, UseExpandedRowProps } from 'react-table';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, Icon, IconButton, Menu, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';

import { FlameGraphDataContainer, LevelItem } from '../../FlameGraph/dataTransform';
import { GetExtraContextMenuButtonsFunction } from '../FlameGraph/FlameGraphContextMenu';
import { ColorScheme, ColorSchemeDiff, PaneView, ViewMode } from '../../types';

import {
  buildAllCallTreeNodes,
  buildCallersTree,
  CallTreeNode,
  getInitialExpandedState,
  getRowBarColor,
} from './utils';

type Styles = ReturnType<typeof getStyles>;

type Props = {
  data: FlameGraphDataContainer;
  onSymbolClick: (symbol: string) => void;
  sandwichItem?: string;
  onSandwich: (str?: string) => void;
  onTableSort?: (sort: string) => void;
  colorScheme: ColorScheme | ColorSchemeDiff;
  search: string;
  onSearch?: (symbol: string) => void;
  focusedItemIndexes?: number[];
  setFocusedItemIndexes?: (itemIndexes: number[] | undefined) => void;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;
  viewMode?: ViewMode;
  paneView?: PaneView;
};

const FlameGraphCallTreeContainer = memo(
  ({
    data,
    onSymbolClick,
    sandwichItem,
    onSandwich,
    search,
    onSearch,
    focusedItemIndexes,
    setFocusedItemIndexes,
    getExtraContextMenuButtons,
    viewMode,
    paneView,
  }: Props) => {
    const [isCompact, setIsCompact] = useState(false);
    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    // Track which search match we've scrolled to, to avoid re-scrolling on every render
    const lastScrolledMatchRef = useRef<string | undefined>(undefined);

    const colorScheme = data.isDiffFlamegraph() ? ColorSchemeDiff.Default : ColorScheme.PackageBased;

    const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(undefined);
    const [callersNodeLabel, setCallersNodeLabel] = useState<string | undefined>(undefined);

    // react to sandwich mode applied in other visualizations by turning on callers mode
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

    const handleSetFocusMode = useCallback(
      (nodeIdOrLabel: string | undefined, isLabel = false, itemIndexes?: number[]) => {
        if (nodeIdOrLabel === undefined) {
          setFocusedNodeId(undefined);
          // Sync with flame graph's focus mode
          setFocusedItemIndexes?.(undefined);
        } else if (isLabel) {
          // When switching from callers mode, we need to find the node by label in the normal tree
          setFocusedNodeId(`label:${nodeIdOrLabel}`);
          // Sync with flame graph's focus mode
          setFocusedItemIndexes?.(itemIndexes);
        } else {
          setFocusedNodeId(nodeIdOrLabel);
          // Sync with flame graph's focus mode
          setFocusedItemIndexes?.(itemIndexes);
        }

        if (nodeIdOrLabel !== undefined) {
          setCallersNodeLabel(undefined);
        }
      },
      [setFocusedItemIndexes]
    );

    const handleSetCallersMode = useCallback(
      (label: string | undefined) => {
        setCallersNodeLabel(label);
        if (label !== undefined) {
          setFocusedNodeId(undefined);
        }
        // Sync with flame graph's sandwich mode
        onSandwich(label);
      },
      [onSandwich]
    );

    const allNodes = useMemo(() => buildAllCallTreeNodes(data), [data]);

    const { nodes, focusedNode, callersNode } = useMemo(() => {
      let nodesToUse = allNodes;
      let focusedNode: CallTreeNode | undefined;
      let callersTargetNode: CallTreeNode | undefined;

      if (focusedNodeId) {
        const isLabelSearch = focusedNodeId.startsWith('label:');
        const searchKey = isLabelSearch ? focusedNodeId.substring(6) : focusedNodeId;

        const findNode = (nodes: CallTreeNode[], searchKey: string, byLabel: boolean): CallTreeNode | undefined => {
          for (const node of nodes) {
            if (byLabel ? node.label === searchKey : node.id === searchKey) {
              return node;
            }
            if (node.children) {
              const found = findNode(node.children, searchKey, byLabel);
              if (found) {
                return found;
              }
            }
          }
          return undefined;
        };

        focusedNode = findNode(allNodes, searchKey, isLabelSearch);
        if (focusedNode) {
          if (isLabelSearch) {
            // Update asynchronously to avoid updating state during render
            setTimeout(() => setFocusedNodeId(focusedNode!.id), 0);
          }

          if (focusedNode.parentId) {
            const parent = findNode(allNodes, focusedNode.parentId, false);
            if (parent) {
              const modifiedParent: CallTreeNode = {
                ...parent,
                children: [focusedNode],
              };
              nodesToUse = [modifiedParent];
            } else {
              nodesToUse = [focusedNode];
            }
          } else {
            nodesToUse = [focusedNode];
          }
        }
      }

      if (callersNodeLabel) {
        const [callers, _] = data.getSandwichLevels(callersNodeLabel);

        if (callers.length > 0) {
          nodesToUse = buildCallersTree(callers, data);
          // The first node in the tree is the target function
          callersTargetNode = nodesToUse.length > 0 ? nodesToUse[0] : undefined;
        } else {
          nodesToUse = [];
          callersTargetNode = undefined;
        }
      }

      return { nodes: nodesToUse, focusedNode: focusedNode, callersNode: callersTargetNode };
    }, [allNodes, data, focusedNodeId, callersNodeLabel]);

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

          if (node.children && matches.length < MAX_MATCHES) {
            search(node.children);
          }
        }
      };

      search(nodes);
      matches.sort((a, b) => b.total - a.total);

      const matchIds = matches.map((m) => m.id);

      setSearchError(undefined);
      return matchIds;
    }, [searchQuery, nodes]);

    // When focusedItemIndexes changes (from flame graph focus), set focus mode in the call tree
    useEffect(() => {
      if (!focusedItemIndexes || focusedItemIndexes.length === 0) {
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
          if (itemIndexesMatch(node.levelItem.itemIndexes, focusedItemIndexes)) {
            return node.id;
          }
          if (node.children) {
            const found = findExactMatch(node.children);
            if (found) {
              return found;
            }
          }
        }
        return undefined;
      };

      const matchedNodeId = findExactMatch(allNodes);
      if (matchedNodeId) {
        setFocusedNodeId(matchedNodeId);
      }
    }, [focusedItemIndexes, allNodes]);

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

    // Callback ref that scrolls when the search match row is rendered
    const searchMatchRowRef = useCallback(
      (node: HTMLTableRowElement | null) => {
        if (node && currentSearchMatchId && currentSearchMatchId !== lastScrolledMatchRef.current) {
          lastScrolledMatchRef.current = currentSearchMatchId;
          const container = scrollContainerRef.current;
          if (container) {
            // Use requestAnimationFrame to ensure layout is complete
            requestAnimationFrame(() => {
              const rowRect = node.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const rowTopRelativeToContainer = rowRect.top - containerRect.top + container.scrollTop;
              const targetScrollTop = rowTopRelativeToContainer - container.clientHeight / 2 + rowRect.height / 2;
              container.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth',
              });
            });
          }
        }
      },
      [currentSearchMatchId]
    );

    const expandedState = useMemo(() => {
      const baseExpanded = getInitialExpandedState(nodes, 1);

      const expandPathToNode = (nodes: CallTreeNode[], targetId: string): boolean => {
        for (const node of nodes) {
          if (node.id === targetId) {
            return true;
          }
          if (node.children && node.children.length > 0) {
            const foundInSubtree = expandPathToNode(node.children, targetId);
            if (foundInSubtree) {
              baseExpanded[node.id] = true;
              return true;
            }
          }
        }
        return false;
      };

      if (currentSearchMatchId) {
        expandPathToNode(nodes, currentSearchMatchId);
      }

      if (focusedNodeId && nodes.length > 0) {
        const rootNode = nodes[0];

        const isLabelSearch = focusedNodeId.startsWith('label:');
        const searchLabel = isLabelSearch ? focusedNodeId.substring(6) : undefined;

        if (rootNode.children && rootNode.children.length > 0) {
          baseExpanded['0'] = true;
        }

        const isRootTheFocusedNode = isLabelSearch ? rootNode.label === searchLabel : rootNode.id === focusedNodeId;

        if (!isRootTheFocusedNode && rootNode.children && rootNode.children.length > 0) {
          baseExpanded['0.0'] = true;
        }
      }

      if (callersNodeLabel && callersNode && nodes.length > 0) {
        expandPathToNode(nodes, callersNode.id);

        if (callersNode.children && callersNode.children.length > 0) {
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
    const FUNCTION_MIN_WIDTH = 100;
    // Minimum width for the function column to be readable in non-compact mode
    const FUNCTION_COMPACT_THRESHOLD = 550;

    const getFixedColumnsWidth = (isDiff: boolean, compactMode: boolean): number => {
      if (compactMode) {
        // Compact mode hides color bar and self column
        return isDiff ? ACTIONS_WIDTH + BASELINE_WIDTH + COMPARISON_WIDTH + DIFF_WIDTH : ACTIONS_WIDTH + TOTAL_WIDTH;
      }
      return isDiff
        ? ACTIONS_WIDTH + COLOR_BAR_WIDTH + BASELINE_WIDTH + COMPARISON_WIDTH + DIFF_WIDTH
        : ACTIONS_WIDTH + COLOR_BAR_WIDTH + SELF_WIDTH + TOTAL_WIDTH;
    };

    const isDiff = data.isDiffFlamegraph();

    // Width threshold below which we switch to compact mode
    const compactModeThreshold = getFixedColumnsWidth(isDiff, false) + FUNCTION_COMPACT_THRESHOLD;

    const compact = isCompact;

    const getFunctionColumnWidth = (availableWidth: number, compactMode: boolean): number | undefined => {
      if (availableWidth <= 0) {
        return undefined;
      }
      const fixedWidth = getFixedColumnsWidth(isDiff, compactMode);
      return Math.max(availableWidth - fixedWidth, FUNCTION_MIN_WIDTH);
    };

    const commonColumns: Array<Column<CallTreeNode>> = [
      {
        Header: '',
        id: 'actions',
        Cell: ({ row }: { row: Row<CallTreeNode> }) => (
          <ActionsCell
            nodeId={row.original.id}
            label={row.original.label}
            itemIndexes={row.original.levelItem.itemIndexes}
            levelItem={row.original.levelItem}
            hasChildren={Boolean(row.original.children?.length)}
            depth={row.original.depth - depthOffset}
            parentId={row.original.parentId}
            onFocus={handleSetFocusMode}
            onShowCallers={handleSetCallersMode}
            onSearch={onSearch}
            focusedNodeId={focusedNodeId}
            callersNodeLabel={callersNodeLabel}
            isSearchMatch={searchNodes?.includes(row.original.id) ?? false}
            actionsCellClass={styles.actionsCell}
            getExtraContextMenuButtons={getExtraContextMenuButtons}
            data={data}
            viewMode={viewMode}
            paneView={paneView}
            search={search}
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
            hasChildren={Boolean(row.original.children?.length)}
            rowIndex={rowIndex}
            rows={tableInstance.rows}
            onSymbolClick={onSymbolClick}
            styles={styles}
            compact={compact}
            toggleRowExpanded={tableInstance.toggleRowExpanded}
          />
        ),
        minWidth: FUNCTION_MIN_WIDTH,
      },
    ];

    const columns = useMemo<Array<Column<CallTreeNode>>>(() => {
      if (data.isDiffFlamegraph()) {
        const cols: Array<Column<CallTreeNode>> = commonColumns;

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
              />
            ),
            minWidth: COLOR_BAR_WIDTH,
            width: COLOR_BAR_WIDTH,
            disableSortBy: true,
          });
        }

        cols.push(
          {
            Header: 'Baseline',
            accessor: 'totalPercent',
            Cell: ({ value }: { value: number }) => `${value.toFixed(2)}%`,
            sortType: 'basic',
            width: BASELINE_WIDTH,
            minWidth: BASELINE_WIDTH,
          },
          {
            Header: 'Comparison',
            accessor: 'totalPercentRight',
            Cell: ({ value }: { value: number | undefined }) => (value !== undefined ? `${value.toFixed(2)}%` : '-'),
            sortType: 'basic',
            width: COMPARISON_WIDTH,
            minWidth: COMPARISON_WIDTH,
          },
          {
            Header: 'Diff %',
            accessor: 'diffPercent',
            Cell: ({ value }: { value: number | undefined }) => <DiffCell value={value} theme={theme} />,
            sortType: 'basic',
            width: DIFF_WIDTH,
            minWidth: DIFF_WIDTH,
          }
        );

        return cols;
      } else {
        const cols: Array<Column<CallTreeNode>> = commonColumns;

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
        getSubRows: (row) => row.children || [],
        initialState: {
          sortBy: [{ id: 'total', desc: true }],
          expanded: expandedState,
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
            // Make space for the vertical scrollbar, otherwise it overlaps the "total" column
            const SCROLLBAR_WIDTH = 16;
            const availableWidth = width - SCROLLBAR_WIDTH;

            // Only update compact mode when crossing the threshold to avoid re-renders on every resize
            const shouldBeCompact = availableWidth > 0 && availableWidth < compactModeThreshold;
            if (shouldBeCompact !== isCompact) {
              queueMicrotask(() => setIsCompact(shouldBeCompact));
            }

            const functionColumnWidth = getFunctionColumnWidth(availableWidth, compact);

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
                <div
                  ref={scrollContainerRef}
                  style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto' }}
                  className={styles.scrollContainer}
                >
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

type ActionsCellProps = {
  nodeId: string;
  label: string;
  itemIndexes: number[];
  levelItem: LevelItem;
  hasChildren: boolean;
  depth: number;
  parentId: string | undefined;
  onFocus: (nodeIdOrLabel: string, isLabel: boolean, itemIndexes: number[]) => void;
  onShowCallers: (label: string) => void;
  onSearch?: (symbol: string) => void;
  focusedNodeId: string | undefined;
  callersNodeLabel: string | undefined;
  isSearchMatch: boolean;
  actionsCellClass: string;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;
  data: FlameGraphDataContainer;
  viewMode?: ViewMode;
  paneView?: PaneView;
  search: string;
};

const ActionsCell = memo(function ActionsCell({
  nodeId,
  label,
  itemIndexes,
  levelItem,
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
  getExtraContextMenuButtons,
  data,
  viewMode,
  paneView,
  search,
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

  const extraButtons = useMemo(() => {
    if (!getExtraContextMenuButtons) {
      return [];
    }
    const clickedItemData = {
      label,
      item: levelItem,
      posX: 0,
      posY: 0,
    };
    return getExtraContextMenuButtons(clickedItemData, data.data, {
      viewMode: viewMode ?? ViewMode.Single,
      paneView: paneView ?? PaneView.CallTree,
      isDiff: data.isDiffFlamegraph(),
      search,
    });
  }, [getExtraContextMenuButtons, label, levelItem, data, viewMode, paneView, search]);

  const hasAnyAction = shouldShowFocusItem || shouldShowCallersItem || shouldShowSearchItem || extraButtons.length > 0;

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
              onFocus(label, true, itemIndexes);
            } else {
              onFocus(nodeId, false, itemIndexes);
            }
          }}
        />
      )}
      {shouldShowCallersItem && (
        <Menu.Item label="Show callers" icon="expand-arrows-alt" onClick={() => onShowCallers(label)} />
      )}
      {shouldShowSearchItem && <Menu.Item label="Search" icon="search" onClick={() => onSearch!(label)} />}
      {extraButtons.map(({ label: btnLabel, icon, onClick }) => (
        <Menu.Item key={btnLabel} label={btnLabel} icon={icon} onClick={onClick} />
      ))}
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
  compact?: boolean;
  toggleRowExpanded: (id: string[], value?: boolean) => void;
}) {
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

function ColorBarCell({
  node,
  data,
  colorScheme,
  theme,
  styles,
  focusedNode,
}: {
  node: CallTreeNode;
  data: FlameGraphDataContainer;
  colorScheme: ColorScheme | ColorSchemeDiff;
  theme: GrafanaTheme2;
  styles: Styles;
  focusedNode?: CallTreeNode;
}) {
  const barColor = getRowBarColor(node, data, colorScheme, theme);

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

function DiffCell({ value, theme }: { value: number | undefined; theme: GrafanaTheme2 }) {
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
      borderRadius: theme.shape.radius.default,
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
      borderRadius: theme.shape.radius.default,
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
