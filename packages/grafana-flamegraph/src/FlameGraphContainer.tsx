import { css } from '@emotion/css';
import uFuzzy from '@leeoniya/ufuzzy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';
import { useMeasure, usePrevious } from 'react-use';

import { type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { ThemeContext } from '@grafana/ui';

import { type GetExtraContextMenuButtonsFunction } from './FlameGraph/FlameGraphContextMenu';
import { FlameGraphDataContainer, type LevelItem } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphPane from './FlameGraphPane';
import { MIN_WIDTH_FOR_SPLIT_VIEW, FLAMEGRAPH_CONTAINER_HEIGHT, VISIBLE_TRUNCATED_DEBOUNCE_MS } from './constants';
import { type ReportVisibleTruncatedPaths } from './hooks';
import { PaneView, ViewMode } from './types';
import { getAssistantContextFromDataFrame } from './utils';

const ufuzzy = new uFuzzy();

export type Props = {
  /**
   * DataFrame with the profile data. The dataFrame needs to have the following fields:
   * label: string - the label of the node
   * level: number - the nesting level of the node
   * value: number - the total value of the node
   * self: number - the self value of the node
   * Optionally if it represents diff of 2 different profiles it can also have fields:
   * valueRight: number - the total value of the node in the right profile
   * selfRight: number - the self value of the node in the right profile
   */
  data?: DataFrame;

  /**
   * Whether the header should be sticky and be always visible on the top when scrolling.
   */
  stickyHeader?: boolean;

  /**
   * Provides a theme for the visualization on which colors and some sizes are based.
   */
  getTheme: () => GrafanaTheme2;

  /**
   * Various interaction hooks that can be used to report on the interaction.
   */
  onTableSymbolClick?: (symbol: string) => void;
  onViewSelected?: (view: string) => void;
  onTextAlignSelected?: (align: string) => void;
  onTableSort?: (sort: string) => void;

  /**
   * Elements that will be shown in the header on the right side of the header buttons. Useful for additional
   * functionality.
   */
  extraHeaderElements?: React.ReactNode;

  /**
   * Extra buttons that will be shown in the context menu when user clicks on a Node.
   */
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;

  /**
   * If true the flamegraph will be rendered on top of the table.
   */
  vertical?: boolean;

  /**
   * If true only the flamegraph will be rendered.
   */
  showFlameGraphOnly?: boolean;

  /**
   * Disable behaviour where similar items in the same stack will be collapsed into single item.
   */
  disableCollapsing?: boolean;
  /**
   * Whether or not to keep any focused item when the profile data changes.
   */
  keepFocusOnDataChange?: boolean;

  /**
   * Called when the user focuses a node or resets the focus, with the call path of the focused node from the root
   * (undefined when the focus is reset). Lets a host react to what the user is looking at, for example to load more
   * detail for that part of the profile.
   */
  onFocusChange?: (path: string[] | undefined) => void;

  /**
   * Called with the call paths of the truncated ('other') nodes the user can currently see, as the active view defines
   * visible: wide enough to be drawn as a real bar in the flame graph, expanded into a row in the call tree. Lets a
   * host fetch the data behind them. Sandwich views report nothing, because their paths are not call paths.
   */
  onVisibleTruncatedPathsChange?: (paths: string[][]) => void;

  /**
   * Call paths of the nodes whose data is currently being loaded, as returned by onVisibleTruncatedPathsChange or
   * onFocusChange. Those nodes are marked as loading in the flame graph and the call tree. Useful when the profile is
   * refined progressively and parts of it are still coming in.
   */
  loadingPaths?: string[][];

  /**
   * If true, the assistant button will be shown in the header if available.
   * This is needed mainly for Profiles Drilldown where in some cases we need to hide the button to show alternative
   * option to use AI.
   * @default true
   */
  showAnalyzeWithAssistant?: boolean;

  /**
   * No longer has any effect. The pane-based UI with call tree support is always used now. Kept so that existing
   * consumers passing this prop don't get a compile error.
   * @deprecated
   */
  enableNewUI?: boolean;

  /**
   * Set this when the host bounds our height (e.g. a dashboard panel), so the top table sizes itself to the
   * space actually available instead of a fixed height that can run past the host's bottom edge. Leave it off
   * for hosts that don't bound us (e.g. Explore, where the page scrolls and the flame graph grows organically):
   * there is no height to fill, so the table falls back to FLAMEGRAPH_CONTAINER_HEIGHT.
   */
  fillHeight?: boolean;

  /**
   * Render the top table with TableNG instead of the legacy Table.
   */
  useTableNG?: boolean;

  /**
   * Forwarded to the top table's TableNG. This package can't read feature toggles itself, so the flags
   * TableNG expects (`table.refresh`, `table.autoColumnWidths`) have to come in from the host, otherwise
   * the top table renders without them while every other TableNG in Grafana has them.
   */
  tableRefreshEnabled?: boolean;
  contentAwareWidthsEnabled?: boolean;
};

const FlameGraphContainer = ({
  data,
  onTableSymbolClick,
  onViewSelected,
  onTextAlignSelected,
  onTableSort,
  getTheme,
  stickyHeader,
  extraHeaderElements,
  vertical,
  showFlameGraphOnly,
  disableCollapsing,
  keepFocusOnDataChange,
  onFocusChange,
  onVisibleTruncatedPathsChange,
  loadingPaths,
  getExtraContextMenuButtons,
  showAnalyzeWithAssistant = true,
  fillHeight,
  useTableNG,
  tableRefreshEnabled,
  contentAwareWidthsEnabled,
}: Props) => {
  const theme = useMemo(() => getTheme(), [getTheme]);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
  const [leftPaneView, setLeftPaneView] = useState<PaneView>(PaneView.TopTable);
  const [rightPaneView, setRightPaneView] = useState<PaneView>(PaneView.FlameGraph);
  const [singleView, setSingleView] = useState<PaneView>(PaneView.FlameGraph);
  const [panesSwapped, setPanesSwapped] = useState(false);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const [resetKey, setResetKey] = useState(0);
  const [focusedItemIndexes, setFocusedItemIndexes] = useState<number[] | undefined>(undefined);
  const [sharedSandwichItem, setSharedSandwichItem] = useState<string | undefined>(undefined);

  const canShowSplitView = containerWidth > 0 && (containerWidth >= MIN_WIDTH_FOR_SPLIT_VIEW || Boolean(vertical));

  const onTableSymbolClickRef = useRef(onTableSymbolClick);
  const onTextAlignSelectedRef = useRef(onTextAlignSelected);
  const onTableSortRef = useRef(onTableSort);
  const onFocusChangeRef = useRef(onFocusChange);
  const onVisibleTruncatedPathsChangeRef = useRef(onVisibleTruncatedPathsChange);

  useEffect(() => {
    onTableSymbolClickRef.current = onTableSymbolClick;
    onTextAlignSelectedRef.current = onTextAlignSelected;
    onTableSortRef.current = onTableSort;
    onFocusChangeRef.current = onFocusChange;
    onVisibleTruncatedPathsChangeRef.current = onVisibleTruncatedPathsChange;
  });

  const stableOnTableSymbolClick = useCallback((symbol: string) => {
    onTableSymbolClickRef.current?.(symbol);
  }, []);

  const stableOnTextAlignSelected = useCallback((align: string) => {
    onTextAlignSelectedRef.current?.(align);
  }, []);

  const stableOnTableSort = useCallback((sort: string) => {
    onTableSortRef.current?.(sort);
  }, []);

  const dataContainer = useMemo((): FlameGraphDataContainer | undefined => {
    if (!data) {
      return;
    }

    return new FlameGraphDataContainer(data, { collapsing: !disableCollapsing }, theme);
  }, [data, theme, disableCollapsing]);

  const loadingItems = useMemo(() => {
    if (!dataContainer || !loadingPaths?.length) {
      return undefined;
    }

    const items = new Set<LevelItem>();

    for (const path of loadingPaths) {
      const item = dataContainer.getItemByPath(path);

      if (item) {
        items.add(item);
      }
    }

    return items.size ? items : undefined;
  }, [dataContainer, loadingPaths]);

  const pathsByViewRef = useRef(new Map<string, string[][]>());
  const emittedRef = useRef<{ data?: FlameGraphDataContainer; key?: string }>({});
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dataContainerRef = useRef(dataContainer);
  dataContainerRef.current = dataContainer;

  const stableReportVisibleTruncatedPaths = useCallback<ReportVisibleTruncatedPaths>((viewId, paths) => {
    pathsByViewRef.current.set(viewId, paths);

    clearTimeout(emitTimerRef.current);
    emitTimerRef.current = setTimeout(() => {
      const byKey = new Map<string, string[]>();

      for (const viewPaths of pathsByViewRef.current.values()) {
        for (const path of viewPaths) {
          byKey.set(JSON.stringify(path), path);
        }
      }

      const key = [...byKey.keys()].sort().join('\n');

      // Re-emitted for every new profile even when the set is unchanged: a refinement that came back still truncated
      // leaves the same paths on screen, and the host has to hear about them again to ask for more detail.
      if (emittedRef.current.data === dataContainerRef.current && emittedRef.current.key === key) {
        return;
      }

      emittedRef.current = { data: dataContainerRef.current, key };
      onVisibleTruncatedPathsChangeRef.current?.([...byKey.values()]);
    }, VISIBLE_TRUNCATED_DEBOUNCE_MS);
  }, []);

  useEffect(() => () => clearTimeout(emitTimerRef.current), []);

  const previousDataContainerRef = useRef(dataContainer);
  const focusedItemPathRef = useRef<string[] | undefined>(undefined);

  useEffect(() => {
    if (!dataContainer) {
      return;
    }

    const dataChanged = previousDataContainerRef.current !== dataContainer;
    previousDataContainerRef.current = dataContainer;

    let item = focusedItemIndexes?.length ? dataContainer.getItemByIndexes(focusedItemIndexes) : undefined;

    if (dataChanged) {
      item =
        keepFocusOnDataChange && focusedItemPathRef.current
          ? dataContainer.getItemByPath(focusedItemPathRef.current)
          : undefined;
      setFocusedItemIndexes(item ? item.itemIndexes : undefined);
    }

    const path = item && dataContainer.getItemPath(item);
    const previous = focusedItemPathRef.current;
    const unchanged =
      path === previous ||
      (path && previous && path.length === previous.length && path.every((l, i) => l === previous[i]));

    focusedItemPathRef.current = path;

    if (!unchanged) {
      onFocusChangeRef.current?.(path);
    }
  }, [focusedItemIndexes, dataContainer, keepFocusOnDataChange]);

  const styles = getStyles(theme, Boolean(fillHeight));
  const matchedLabels = useLabelSearch(search, dataContainer);

  const effectiveViewMode = canShowSplitView ? viewMode : ViewMode.Single;

  const prevViewMode = usePrevious(viewMode);
  useEffect(() => {
    if (prevViewMode === undefined) {
      return;
    }
    if (prevViewMode === ViewMode.Split && viewMode === ViewMode.Single) {
      setSingleView(rightPaneView);
    } else if (prevViewMode === ViewMode.Single && viewMode === ViewMode.Split) {
      setRightPaneView(singleView);
    }
  }, [viewMode, prevViewMode, rightPaneView, singleView]);

  if (!dataContainer) {
    return null;
  }

  const commonPaneProps = {
    dataContainer,
    search,
    matchedLabels,
    onTableSymbolClick: stableOnTableSymbolClick,
    onTextAlignSelected: stableOnTextAlignSelected,
    onTableSort: stableOnTableSort,
    showFlameGraphOnly,
    disableCollapsing,
    getExtraContextMenuButtons,
    setSearch,
    resetKey,
    keepFocusOnDataChange,
    focusedItemIndexes,
    setFocusedItemIndexes,
    useTableNG,
    tableRefreshEnabled,
    contentAwareWidthsEnabled,
    fillHeight,
    loadingItems,
    // Without a listener the views skip the collection entirely, so no consumer pays for a feature it does not use.
    reportVisibleTruncatedPaths: onVisibleTruncatedPathsChange ? stableReportVisibleTruncatedPaths : undefined,
  };

  let body;
  if (showFlameGraphOnly) {
    body = (
      <FlameGraphPane
        {...commonPaneProps}
        paneView={PaneView.FlameGraph}
        viewMode={effectiveViewMode}
        paneViewForContextMenu={PaneView.FlameGraph}
        sharedSandwichItem={sharedSandwichItem}
        setSharedSandwichItem={setSharedSandwichItem}
      />
    );
  } else if (effectiveViewMode === ViewMode.Single) {
    body = (
      <FlameGraphPane
        {...commonPaneProps}
        paneView={singleView}
        viewMode={ViewMode.Single}
        paneViewForContextMenu={singleView}
        sharedSandwichItem={sharedSandwichItem}
        setSharedSandwichItem={setSharedSandwichItem}
      />
    );
  } else {
    const shouldSyncSandwich = leftPaneView !== rightPaneView;

    const leftPane = (
      <FlameGraphPane
        {...commonPaneProps}
        key="left-pane"
        paneView={leftPaneView}
        viewMode={ViewMode.Split}
        paneViewForContextMenu={leftPaneView}
        sharedSandwichItem={shouldSyncSandwich ? sharedSandwichItem : undefined}
        setSharedSandwichItem={shouldSyncSandwich ? setSharedSandwichItem : undefined}
      />
    );

    const rightPane = (
      <FlameGraphPane
        {...commonPaneProps}
        key="right-pane"
        paneView={rightPaneView}
        viewMode={ViewMode.Split}
        paneViewForContextMenu={rightPaneView}
        sharedSandwichItem={shouldSyncSandwich ? sharedSandwichItem : undefined}
        setSharedSandwichItem={shouldSyncSandwich ? setSharedSandwichItem : undefined}
      />
    );

    if (vertical) {
      body = (
        <div className={styles.verticalContainer}>
          <div className={styles.verticalPaneContainer} style={{ order: panesSwapped ? 2 : 1 }}>
            {leftPane}
          </div>
          <div className={styles.verticalPaneContainer} style={{ order: panesSwapped ? 1 : 2 }}>
            {rightPane}
          </div>
        </div>
      );
    } else {
      body = (
        <div className={styles.horizontalContainer}>
          <div className={styles.horizontalPaneContainer} style={{ order: panesSwapped ? 2 : 1 }}>
            {leftPane}
          </div>
          <div className={styles.horizontalPaneContainer} style={{ order: panesSwapped ? 1 : 2 }}>
            {rightPane}
          </div>
        </div>
      );
    }
  }

  return (
    // We add the theme context to bridge the gap if this is rendered in non grafana environment where the context
    // isn't already provided.
    <ThemeContext.Provider value={theme}>
      <div ref={sizeRef} className={styles.container}>
        {!showFlameGraphOnly && (
          <FlameGraphHeader
            search={search}
            setSearch={setSearch}
            viewMode={viewMode}
            setViewMode={(mode) => {
              setViewMode(mode);
              onViewSelected?.(mode === ViewMode.Split ? 'split' : singleView);
            }}
            canShowSplitView={canShowSplitView}
            containerWidth={containerWidth}
            leftPaneView={panesSwapped ? rightPaneView : leftPaneView}
            setLeftPaneView={panesSwapped ? setRightPaneView : setLeftPaneView}
            rightPaneView={panesSwapped ? leftPaneView : rightPaneView}
            setRightPaneView={panesSwapped ? setLeftPaneView : setRightPaneView}
            singleView={singleView}
            setSingleView={(view) => {
              setSingleView(view);
              if (viewMode === ViewMode.Single) {
                onViewSelected?.(view);
              }
            }}
            onSwapPanes={() => setPanesSwapped((s) => !s)}
            onReset={() => {
              setSearch('');
              setFocusedItemIndexes(undefined);
              setSharedSandwichItem(undefined);
              setResetKey((k) => k + 1);
            }}
            showResetButton={Boolean(search)}
            stickyHeader={Boolean(stickyHeader)}
            extraHeaderElements={extraHeaderElements}
            assistantContext={data && showAnalyzeWithAssistant ? getAssistantContextFromDataFrame(data) : undefined}
          />
        )}

        <div className={styles.body}>{body}</div>
      </div>
    </ThemeContext.Provider>
  );
};

/**
 * Based on the search string it does a fuzzy search over all the unique labels, so we can highlight them later.
 */
function useLabelSearch(
  search: string | undefined,
  data: FlameGraphDataContainer | undefined
): Set<string> | undefined {
  return useMemo(() => {
    if (!search || !data) {
      // In this case undefined means there was no search so no attempt to
      // highlighting anything should be made.
      return undefined;
    }

    return labelSearch(search, data);
  }, [search, data]);
}

export function labelSearch(search: string, data: FlameGraphDataContainer): Set<string> {
  const foundLabels = new Set<string>();
  const terms = search.split(',');

  const regexFilter = (labels: string[], pattern: string): boolean => {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (e) {
      return false;
    }

    let foundMatch = false;
    for (let label of labels) {
      if (!regex.test(label)) {
        continue;
      }

      foundLabels.add(label);
      foundMatch = true;
    }
    return foundMatch;
  };

  const fuzzyFilter = (labels: string[], term: string): boolean => {
    let idxs = ufuzzy.filter(labels, term);
    if (!idxs) {
      return false;
    }

    let foundMatch = false;
    for (let idx of idxs) {
      foundLabels.add(labels[idx]);
      foundMatch = true;
    }
    return foundMatch;
  };

  for (let term of terms) {
    if (!term) {
      continue;
    }

    const found = regexFilter(data.getUniqueLabels(), term);
    if (!found) {
      fuzzyFilter(data.getUniqueLabels(), term);
    }
  }

  return foundLabels;
}

/**
 * `fillHeight` hosts (e.g. a dashboard panel) bound our height, so the panes take their share of it and the
 * top table's bottom edge lands on the host's. Hosts that don't bound us (e.g. Explore) have no height to
 * share out, so those same panes keep the fixed FLAMEGRAPH_CONTAINER_HEIGHT they have always used - a
 * percentage would resolve against an indefinite ancestor and collapse to the table's header.
 */
function getStyles(theme: GrafanaTheme2, fillHeight: boolean) {
  return {
    container: css({
      label: 'container',
      overflow: 'auto',
      height: '100%',
      display: 'flex',
      flex: '1 1 0',
      flexDirection: 'column',
      minHeight: 0,
      gap: theme.spacing(1),
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      // Without this, a flex item's automatic minimum size is its content's natural size, which lets this
      // (and the table under it) grow to the flame graph's organic height instead of shrinking to the space
      // .container actually has.
      minHeight: 0,
    }),

    horizontalContainer: css({
      label: 'horizontalContainer',
      display: 'flex',
      height: '100%',
      minHeight: 0,
      flexDirection: 'row',
      columnGap: theme.spacing(1),
      width: '100%',
    }),

    verticalContainer: css({
      label: 'verticalContainer',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
    }),

    horizontalPaneContainer: css({
      label: 'horizontalPaneContainer',
      flexBasis: '50%',
      minWidth: 0,
      overflow: 'auto',
      ...(fillHeight ? { height: '100%', minHeight: 0 } : { maxHeight: FLAMEGRAPH_CONTAINER_HEIGHT }),
    }),

    verticalPaneContainer: css({
      label: 'verticalPaneContainer',
      marginBottom: theme.spacing(1),
      ...(fillHeight ? { flex: '1 1 0', minHeight: 0 } : { height: FLAMEGRAPH_CONTAINER_HEIGHT }),
    }),
  };
}

export default FlameGraphContainer;
