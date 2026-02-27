import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useTable, useSortBy, useExpanded, Column, Row, UseExpandedRowProps } from 'react-table';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Button, Icon, IconButton, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';

import { GetExtraContextMenuButtonsFunction } from '../FlameGraph/FlameGraphContextMenu';
import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { ColorScheme, ColorSchemeDiff, PaneView, ViewMode } from '../types';

import { ActionsCell } from './ActionsCell';
import { CallTreeTable } from './CallTreeTable';
import { ColorBarCell } from './ColorBarCell';
import { DiffCell } from './DiffCell';
import { FunctionCellWithExpander } from './FunctionCellWithExpander';
import { getStyles } from './styles';
import { buildAllCallTreeNodes, buildCallersTree, CallTreeNode, getInitialExpandedState } from './utils';

type Props = {
  data: FlameGraphDataContainer;
  onSymbolClick: (symbol: string) => void;
  sandwichItem?: string;
  onSandwich: (str?: string) => void;
  onTableSort?: (sort: string) => void;
  search: string;
  onSearch?: (symbol: string) => void;
  focusedItemIndexes?: number[];
  setFocusedItemIndexes?: (itemIndexes: number[] | undefined) => void;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;
  viewMode?: ViewMode;
  paneView?: PaneView;
};

function findCallTreeNode(nodes: CallTreeNode[], searchKey: string, byLabel: boolean): CallTreeNode | undefined {
  for (const node of nodes) {
    if (byLabel ? node.label === searchKey : node.id === searchKey) {
      return node;
    }
    if (node.children) {
      const found = findCallTreeNode(node.children, searchKey, byLabel);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

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
    const lastScrolledMatchRef = useRef<string | undefined>(undefined);
    const tableInstanceRef = useRef<{
      rows: Array<Row<CallTreeNode>>;
      toggleRowExpanded: (id: string[], value?: boolean) => void;
    }>({ rows: [], toggleRowExpanded: () => {} });

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

    const handleSetFocusMode = useCallback(
      (nodeIdOrLabel: string | undefined, isLabel = false, itemIndexes?: number[]) => {
        if (nodeIdOrLabel === undefined) {
          setFocusedNodeId(undefined);
          setFocusedItemIndexes?.(undefined);
        } else if (isLabel) {
          setFocusedNodeId(`label:${nodeIdOrLabel}`);
          setFocusedItemIndexes?.(itemIndexes);
        } else {
          setFocusedNodeId(nodeIdOrLabel);
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

        focusedNode = findCallTreeNode(allNodes, searchKey, isLabelSearch);
        if (focusedNode) {
          if (focusedNode.parentId) {
            const parent = findCallTreeNode(allNodes, focusedNode.parentId, false);
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
        const [callers] = data.getSandwichLevels(callersNodeLabel);

        if (callers.length > 0) {
          nodesToUse = buildCallersTree(callers, data);
          callersTargetNode = nodesToUse.length > 0 ? nodesToUse[0] : undefined;
        } else {
          nodesToUse = [];
          callersTargetNode = undefined;
        }
      }

      return { nodes: nodesToUse, focusedNode: focusedNode, callersNode: callersTargetNode };
    }, [allNodes, data, focusedNodeId, callersNodeLabel]);

    const resolvedFocusNodeId = useMemo(() => {
      if (!focusedNodeId?.startsWith('label:')) {
        return undefined;
      }
      const searchKey = focusedNodeId.substring(6);
      return findCallTreeNode(allNodes, searchKey, true)?.id;
    }, [focusedNodeId, allNodes]);

    useEffect(() => {
      if (!focusedNodeId?.startsWith('label:') || !resolvedFocusNodeId) {
        return;
      }
      if (resolvedFocusNodeId !== focusedNodeId) {
        setFocusedNodeId(resolvedFocusNodeId);
      }
    }, [resolvedFocusNodeId, focusedNodeId]);

    const depthOffset = useMemo(() => {
      if (focusedNodeId && nodes.length > 0) {
        return nodes[0].depth;
      }
      return 0;
    }, [focusedNodeId, nodes]);

    const { searchNodes, searchError } = useMemo(() => {
      if (!searchQuery.trim()) {
        return { searchNodes: [], searchError: undefined };
      }

      const MAX_MATCHES = 50;
      const matches: Array<{ id: string; total: number }> = [];

      const regexChars = /[.*+?^${}()|[\]\\]/;
      let isRegexQuery = regexChars.test(searchQuery);
      let searchRegex: RegExp | null = null;
      let searchError: string | undefined;

      if (isRegexQuery) {
        try {
          searchRegex = new RegExp(searchQuery, 'i');
        } catch (e) {
          searchError = 'Invalid regex pattern';
          return { searchNodes: [], searchError };
        }
      }

      const searchFn = (nodesToSearch: CallTreeNode[]) => {
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
            searchFn(node.children);
          }
        }
      };

      searchFn(nodes);
      matches.sort((a, b) => b.total - a.total);

      const matchIds = matches.map((m) => m.id);

      return { searchNodes: matchIds, searchError };
    }, [searchQuery, nodes]);

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

    const searchMatchRowRef = useCallback(
      (node: HTMLTableRowElement | null) => {
        if (node && currentSearchMatchId && currentSearchMatchId !== lastScrolledMatchRef.current) {
          lastScrolledMatchRef.current = currentSearchMatchId;
          const container = scrollContainerRef.current;
          if (container) {
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
    const FUNCTION_COMPACT_THRESHOLD = 550;

    const getFixedColumnsWidth = (isDiff: boolean, compactMode: boolean): number => {
      if (compactMode) {
        return isDiff ? ACTIONS_WIDTH + BASELINE_WIDTH + COMPARISON_WIDTH + DIFF_WIDTH : ACTIONS_WIDTH + TOTAL_WIDTH;
      }
      return isDiff
        ? ACTIONS_WIDTH + COLOR_BAR_WIDTH + BASELINE_WIDTH + COMPARISON_WIDTH + DIFF_WIDTH
        : ACTIONS_WIDTH + COLOR_BAR_WIDTH + SELF_WIDTH + TOTAL_WIDTH;
    };

    const isDiff = data.isDiffFlamegraph();

    const compactModeThreshold = getFixedColumnsWidth(isDiff, false) + FUNCTION_COMPACT_THRESHOLD;

    const getFunctionColumnWidth = (availableWidth: number, compactMode: boolean): number | undefined => {
      if (availableWidth <= 0) {
        return undefined;
      }
      const fixedWidth = getFixedColumnsWidth(isDiff, compactMode);
      return Math.max(availableWidth - fixedWidth, FUNCTION_MIN_WIDTH);
    };

    const commonColumns = useMemo<Array<Column<CallTreeNode>>>(() => {
      return [
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
              rows={tableInstanceRef.current.rows}
              onSymbolClick={onSymbolClick}
              styles={styles}
              compact={isCompact}
              toggleRowExpanded={tableInstanceRef.current.toggleRowExpanded}
            />
          ),
          minWidth: FUNCTION_MIN_WIDTH,
        },
      ];
    }, [
      callersNodeLabel,
      data,
      depthOffset,
      focusedNodeId,
      getExtraContextMenuButtons,
      handleSetCallersMode,
      handleSetFocusMode,
      isCompact,
      onSearch,
      onSymbolClick,
      paneView,
      search,
      searchNodes,
      styles,
      viewMode,
    ]);

    const columns = useMemo<Array<Column<CallTreeNode>>>(() => {
      if (data.isDiffFlamegraph()) {
        const cols: Array<Column<CallTreeNode>> = [...commonColumns];

        if (!isCompact) {
          cols.push({
            Header: '',
            id: 'colorBar',
            Cell: ({ row }: { row: Row<CallTreeNode> }) => (
              <ColorBarCell
                node={row.original}
                data={data}
                colorScheme={ColorSchemeDiff.Default}
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
        const cols: Array<Column<CallTreeNode>> = [...commonColumns];

        if (!isCompact) {
          cols.push(
            {
              Header: '',
              id: 'colorBar',
              Cell: ({ row }: { row: Row<CallTreeNode> }) => (
                <ColorBarCell
                  node={row.original}
                  data={data}
                  colorScheme={ColorScheme.PackageBased}
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
    }, [commonColumns, data, isCompact, theme, styles, focusedNode]);

    // currentSearchMatchId is intentionally in the deps despite not being used in the body.
    // Creating a new array identity forces react-table (with autoResetExpanded: true) to
    // recalculate the expanded state from initialState, which includes the path to the
    // current search match.
    const tableNodes = useMemo(() => {
      return [...nodes];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, currentSearchMatchId]);

    const tableInstance = useTable<CallTreeNode>(
      {
        columns,
        data: tableNodes,
        getSubRows: (row) => row.children || [],
        initialState: {
          sortBy: [{ id: 'total', desc: true }],
          expanded: expandedState,
        },
        autoResetExpanded: true,
        autoResetSortBy: false,
      },
      useSortBy,
      useExpanded
    );

    tableInstanceRef.current = tableInstance;
    const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = tableInstance;

    return (
      <div className={styles.container} data-testid="callTree">
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
          {({ width, height }) => (
            <CallTreeTable
              width={width}
              height={height}
              compactModeThreshold={compactModeThreshold}
              isCompact={isCompact}
              setIsCompact={setIsCompact}
              getFunctionColumnWidth={getFunctionColumnWidth}
              getTableProps={getTableProps}
              getTableBodyProps={getTableBodyProps}
              headerGroups={headerGroups}
              rows={rows}
              prepareRow={prepareRow}
              styles={styles}
              currentSearchMatchId={currentSearchMatchId}
              searchMatchRowRef={searchMatchRowRef}
              scrollContainerRef={scrollContainerRef}
              focusedNodeId={focusedNodeId}
              callersNodeLabel={callersNodeLabel}
            />
          )}
        </AutoSizer>
      </div>
    );
  }
);

FlameGraphCallTreeContainer.displayName = 'FlameGraphCallTreeContainer';

export default FlameGraphCallTreeContainer;
