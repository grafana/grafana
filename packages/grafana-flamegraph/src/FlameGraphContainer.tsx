import { css } from '@emotion/css';
import uFuzzy from '@leeoniya/ufuzzy';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import * as React from 'react';
import { useMeasure, usePrevious } from 'react-use';

import { type DataFrame, type GrafanaTheme2, escapeStringForRegex } from '@grafana/data';
import { ThemeContext } from '@grafana/ui';

import FlameGraph from './FlameGraph/FlameGraph';
import { type GetExtraContextMenuButtonsFunction } from './FlameGraph/FlameGraphContextMenu';
import { CollapsedMap, FlameGraphDataContainer } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphPane from './FlameGraphPane';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import {
  MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH,
  MIN_WIDTH_FOR_SPLIT_VIEW,
  FLAMEGRAPH_CONTAINER_HEIGHT,
} from './constants';
import { useColorScheme } from './hooks';
import { type ClickedItemData, PaneView, SelectedView, type TextAlign, ViewMode } from './types';
import { getAssistantContextFromDataFrame } from './utils';

const ufuzzy = new uFuzzy();

/**
 * .container is styled height: 100%, which correctly reflects whatever bounded height a real host (e.g. a
 * dashboard panel) gives it. Some hosts (e.g. Explore) don't bound our height at all, in which case
 * height: 100% collapses several layers down, wherever a descendant first tries to resolve a percentage
 * height against that indefinite ancestor - not necessarily on .container itself, which can still measure
 * taller than a naive "near zero" check thanks to the header (or, in a split flame-graph/table layout, the
 * flame graph's own organic height) padding it out. So rather than measuring .container, this is meant to
 * be attached directly to the thing that actually needs a concrete height - the table wrapper - via a
 * callback ref, which also naturally re-checks whenever that wrapper (re)mounts, e.g. once real data
 * replaces an initial `null` render, instead of a one-shot check tied to this component's own mount.
 */
function useHeightFallback(fallbackHeight: number) {
  const [needsFallback, setNeedsFallback] = useState(false);
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (node && node.getBoundingClientRect().height < 10) {
      setNeedsFallback(true);
    }
  }, []);
  return { measureRef, style: needsFallback ? { height: fallbackHeight } : undefined };
}

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
   * If true, the assistant button will be shown in the header if available.
   * This is needed mainly for Profiles Drilldown where in some cases we need to hide the button to show alternative
   * option to use AI.
   * @default true
   */
  showAnalyzeWithAssistant?: boolean;

  /**
   * Enable the new pane-based UI with call tree support.
   */
  enableNewUI?: boolean;

  /**
   * Render the top table with TableNG instead of the legacy Table.
   */
  useTableNG?: boolean;

  /**
   * Escape hatch to disable virtualization of the top table when useTableNG is set. Only intended for tests,
   * where jsdom cannot measure the grid and virtualization would otherwise render no rows.
   */
  enableVirtualization?: boolean;
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
  getExtraContextMenuButtons,
  showAnalyzeWithAssistant = true,
  enableNewUI,
  useTableNG,
  enableVirtualization,
}: Props) => {
  const theme = useMemo(() => getTheme(), [getTheme]);

  if (enableNewUI) {
    return (
      <NewUIContainer
        data={data}
        onTableSymbolClick={onTableSymbolClick}
        onViewSelected={onViewSelected}
        onTextAlignSelected={onTextAlignSelected}
        onTableSort={onTableSort}
        theme={theme}
        stickyHeader={stickyHeader}
        extraHeaderElements={extraHeaderElements}
        vertical={vertical}
        showFlameGraphOnly={showFlameGraphOnly}
        disableCollapsing={disableCollapsing}
        keepFocusOnDataChange={keepFocusOnDataChange}
        getExtraContextMenuButtons={getExtraContextMenuButtons}
        showAnalyzeWithAssistant={showAnalyzeWithAssistant}
        useTableNG={useTableNG}
        enableVirtualization={enableVirtualization}
      />
    );
  }

  return (
    <LegacyContainer
      data={data}
      onTableSymbolClick={onTableSymbolClick}
      onViewSelected={onViewSelected}
      onTextAlignSelected={onTextAlignSelected}
      onTableSort={onTableSort}
      theme={theme}
      stickyHeader={stickyHeader}
      extraHeaderElements={extraHeaderElements}
      vertical={vertical}
      showFlameGraphOnly={showFlameGraphOnly}
      disableCollapsing={disableCollapsing}
      keepFocusOnDataChange={keepFocusOnDataChange}
      getExtraContextMenuButtons={getExtraContextMenuButtons}
      showAnalyzeWithAssistant={showAnalyzeWithAssistant}
      useTableNG={useTableNG}
      enableVirtualization={enableVirtualization}
    />
  );
};

type InternalProps = {
  data?: DataFrame;
  onTableSymbolClick?: (symbol: string) => void;
  onViewSelected?: (view: string) => void;
  onTextAlignSelected?: (align: string) => void;
  onTableSort?: (sort: string) => void;
  theme: GrafanaTheme2;
  stickyHeader?: boolean;
  extraHeaderElements?: React.ReactNode;
  vertical?: boolean;
  showFlameGraphOnly?: boolean;
  disableCollapsing?: boolean;
  keepFocusOnDataChange?: boolean;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;
  showAnalyzeWithAssistant: boolean;
  useTableNG?: boolean;
  enableVirtualization?: boolean;
};

const LegacyContainer = ({
  data,
  onTableSymbolClick,
  onViewSelected,
  onTextAlignSelected,
  onTableSort,
  theme,
  stickyHeader,
  extraHeaderElements,
  vertical,
  showFlameGraphOnly,
  disableCollapsing,
  keepFocusOnDataChange,
  getExtraContextMenuButtons,
  showAnalyzeWithAssistant,
  useTableNG,
  enableVirtualization,
}: InternalProps) => {
  const [focusedItemData, setFocusedItemData] = useState<ClickedItemData>();

  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedView, setSelectedView] = useState(SelectedView.Both);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const heightFallback = useHeightFallback(FLAMEGRAPH_CONTAINER_HEIGHT);
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
  // This is a label of the item because in sandwich view we group all items by label and present a merged graph
  const [sandwichItem, setSandwichItem] = useState<string>();
  const [collapsedMap, setCollapsedMap] = useState(new CollapsedMap());

  // Use refs to hold the latest callback values to prevent unnecessary re-renders
  const onTableSymbolClickRef = useRef(onTableSymbolClick);
  const onTableSortRef = useRef(onTableSort);

  // Update refs when props change
  onTableSymbolClickRef.current = onTableSymbolClick;
  onTableSortRef.current = onTableSort;

  const dataContainer = useMemo((): FlameGraphDataContainer | undefined => {
    if (!data) {
      return;
    }

    const container = new FlameGraphDataContainer(data, { collapsing: !disableCollapsing }, theme);
    setCollapsedMap(container.getCollapsedMap());
    return container;
  }, [data, theme, disableCollapsing]);
  const [colorScheme, setColorScheme] = useColorScheme(dataContainer);
  const styles = getStyles(theme);
  const matchedLabels = useLabelSearch(search, dataContainer);

  // If user resizes window with both as the selected view
  useEffect(() => {
    if (
      containerWidth > 0 &&
      containerWidth < MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH &&
      selectedView === SelectedView.Both &&
      !vertical
    ) {
      setSelectedView(SelectedView.FlameGraph);
    }
  }, [selectedView, setSelectedView, containerWidth, vertical]);

  const resetFocus = useCallback(() => {
    setFocusedItemData(undefined);
    setRangeMin(0);
    setRangeMax(1);
  }, [setFocusedItemData, setRangeMax, setRangeMin]);

  const resetSandwich = useCallback(() => {
    setSandwichItem(undefined);
  }, [setSandwichItem]);

  useEffect(() => {
    if (!keepFocusOnDataChange) {
      resetFocus();
      resetSandwich();
      return;
    }

    if (dataContainer && focusedItemData) {
      const item = dataContainer.getNodesWithLabel(focusedItemData.label)?.[0];

      if (item) {
        setFocusedItemData({ ...focusedItemData, item });

        const levels = dataContainer.getLevels();
        const totalViewTicks = levels.length ? levels[0][0].value : 0;
        setRangeMin(item.start / totalViewTicks);
        setRangeMax((item.start + item.value) / totalViewTicks);
      } else {
        setFocusedItemData({
          ...focusedItemData,
          item: {
            start: 0,
            value: 0,
            itemIndexes: [],
            children: [],
            level: 0,
          },
        });

        setRangeMin(0);
        setRangeMax(1);
      }
    }
  }, [dataContainer, keepFocusOnDataChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSymbolClick = useCallback(
    (symbol: string) => {
      const anchored = `^${escapeStringForRegex(symbol)}$`;

      if (search === anchored) {
        setSearch('');
      } else {
        onTableSymbolClickRef.current?.(symbol);
        setSearch(anchored);
        resetFocus();
      }
    },
    [setSearch, resetFocus, search]
  );

  // Memoize methods to prevent unnecessary re-renders of FlameGraphTopTableContainer
  const onSearch = useCallback(
    (str: string) => {
      if (!str) {
        setSearch('');
        return;
      }
      setSearch(`^${escapeStringForRegex(str)}$`);
    },
    [setSearch]
  );
  const onSandwich = useCallback(
    (label: string) => {
      resetFocus();
      setSandwichItem(label);
    },
    [resetFocus, setSandwichItem]
  );
  const onTableSortStable = useCallback((sort: string) => {
    onTableSortRef.current?.(sort);
  }, []);

  if (!dataContainer) {
    return null;
  }

  const flameGraph = (
    <FlameGraph
      data={dataContainer}
      rangeMin={rangeMin}
      rangeMax={rangeMax}
      matchedLabels={matchedLabels}
      setRangeMin={setRangeMin}
      setRangeMax={setRangeMax}
      onItemFocused={(data) => setFocusedItemData(data)}
      focusedItemData={focusedItemData}
      textAlign={textAlign}
      sandwichItem={sandwichItem}
      onSandwich={onSandwich}
      onFocusPillClick={resetFocus}
      onSandwichPillClick={resetSandwich}
      colorScheme={colorScheme}
      showFlameGraphOnly={showFlameGraphOnly}
      collapsing={!disableCollapsing}
      getExtraContextMenuButtons={getExtraContextMenuButtons}
      selectedView={selectedView}
      search={search}
      collapsedMap={collapsedMap}
      setCollapsedMap={setCollapsedMap}
    />
  );

  const table = (
    <FlameGraphTopTableContainer
      data={dataContainer}
      onSymbolClick={onSymbolClick}
      search={search}
      matchedLabels={matchedLabels}
      sandwichItem={sandwichItem}
      onSandwich={setSandwichItem}
      onSearch={onSearch}
      onTableSort={onTableSortStable}
      colorScheme={colorScheme}
      useTableNG={useTableNG}
      enableVirtualization={enableVirtualization}
    />
  );

  let body;
  if (showFlameGraphOnly || selectedView === SelectedView.FlameGraph) {
    body = flameGraph;
  } else if (selectedView === SelectedView.TopTable) {
    body = (
      <div ref={heightFallback.measureRef} className={styles.tableContainer}>
        {table}
      </div>
    );
  } else if (selectedView === SelectedView.Both) {
    if (vertical) {
      body = (
        <div className={styles.verticalContainer}>
          <div className={styles.verticalGraphContainer}>{flameGraph}</div>
          <div ref={heightFallback.measureRef} className={styles.verticalTableContainer}>
            {table}
          </div>
        </div>
      );
    } else {
      body = (
        <div className={styles.horizontalContainer}>
          <div ref={heightFallback.measureRef} className={styles.horizontalTableContainer}>
            {table}
          </div>
          <div className={styles.horizontalGraphContainer}>{flameGraph}</div>
        </div>
      );
    }
  }

  return (
    // We add the theme context to bridge the gap if this is rendered in non grafana environment where the context
    // isn't already provided.
    <ThemeContext.Provider value={theme}>
      <div ref={sizeRef} className={styles.container} style={heightFallback.style}>
        {!showFlameGraphOnly && (
          <FlameGraphHeader
            search={search}
            setSearch={setSearch}
            selectedView={selectedView}
            setSelectedView={(view) => {
              setSelectedView(view);
              onViewSelected?.(view);
            }}
            containerWidth={containerWidth}
            onReset={() => {
              resetFocus();
              resetSandwich();
            }}
            textAlign={textAlign}
            onTextAlignChange={(align) => {
              setTextAlign(align);
              onTextAlignSelected?.(align);
            }}
            showResetButton={Boolean(focusedItemData || sandwichItem)}
            colorScheme={colorScheme}
            onColorSchemeChange={setColorScheme}
            stickyHeader={Boolean(stickyHeader)}
            extraHeaderElements={extraHeaderElements}
            vertical={vertical}
            isDiffMode={dataContainer.isDiffFlamegraph()}
            setCollapsedMap={setCollapsedMap}
            collapsedMap={collapsedMap}
            assistantContext={data && showAnalyzeWithAssistant ? getAssistantContextFromDataFrame(data) : undefined}
          />
        )}

        <div className={styles.body}>{body}</div>
      </div>
    </ThemeContext.Provider>
  );
};

const NewUIContainer = ({
  data,
  onTableSymbolClick,
  onViewSelected,
  onTextAlignSelected,
  onTableSort,
  theme,
  stickyHeader,
  extraHeaderElements,
  vertical,
  showFlameGraphOnly,
  disableCollapsing,
  keepFocusOnDataChange,
  getExtraContextMenuButtons,
  showAnalyzeWithAssistant,
  useTableNG,
  enableVirtualization,
}: InternalProps) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
  const [leftPaneView, setLeftPaneView] = useState<PaneView>(PaneView.TopTable);
  const [rightPaneView, setRightPaneView] = useState<PaneView>(PaneView.FlameGraph);
  const [singleView, setSingleView] = useState<PaneView>(PaneView.FlameGraph);
  const [panesSwapped, setPanesSwapped] = useState(false);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const heightFallback = useHeightFallback(FLAMEGRAPH_CONTAINER_HEIGHT);
  const [resetKey, setResetKey] = useState(0);
  const [focusedItemIndexes, setFocusedItemIndexes] = useState<number[] | undefined>(undefined);
  const [sharedSandwichItem, setSharedSandwichItem] = useState<string | undefined>(undefined);

  const canShowSplitView = containerWidth > 0 && (containerWidth >= MIN_WIDTH_FOR_SPLIT_VIEW || Boolean(vertical));

  const onTableSymbolClickRef = useRef(onTableSymbolClick);
  const onTextAlignSelectedRef = useRef(onTextAlignSelected);
  const onTableSortRef = useRef(onTableSort);

  useEffect(() => {
    onTableSymbolClickRef.current = onTableSymbolClick;
    onTextAlignSelectedRef.current = onTextAlignSelected;
    onTableSortRef.current = onTableSort;
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

  const styles = getStyles(theme);
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
    enableVirtualization,
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
    <ThemeContext.Provider value={theme}>
      <div ref={sizeRef} className={styles.container} style={heightFallback.style}>
        {!showFlameGraphOnly && (
          <FlameGraphHeader
            enableNewUI={true}
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

        <div ref={heightFallback.measureRef} className={styles.body}>
          {body}
        </div>
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

function getStyles(theme: GrafanaTheme2) {
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
      // Without this, a flex item's automatic minimum size defaults to its content's natural size, which
      // let this (and everything under it, including the table) grow to match the flame graph's organic,
      // unbounded height instead of shrinking to fit the real space .container has available.
      minHeight: 0,
    }),

    // Single-pane (Top Table only) view. The table manages its own internal scrolling (react-data-grid /
    // react-window), so this just needs to give it its real allotted height to measure against, rather than
    // a fixed constant that could be taller than the panel's actual space - which let the table's bottom
    // run past the panel's bottom.
    tableContainer: css({
      height: '100%',
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

    // Deliberately left with its original (organic, unbounded) sizing - opts out of the row's default
    // stretch behavior so the flame graph keeps rendering at its natural height, same as before.
    horizontalGraphContainer: css({
      flexBasis: '50%',
      minWidth: 0,
      alignSelf: 'flex-start',
    }),

    horizontalTableContainer: css({
      flexBasis: '50%',
      minWidth: 0,
      minHeight: 0,
      overflow: 'auto',
    }),

    verticalGraphContainer: css({
      marginBottom: theme.spacing(1),
    }),

    verticalTableContainer: css({
      flex: '1 1 0',
      minHeight: 0,
      overflow: 'auto',
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
      maxHeight: FLAMEGRAPH_CONTAINER_HEIGHT,
      minWidth: 0,
      overflow: 'auto',
    }),

    verticalPaneContainer: css({
      label: 'verticalPaneContainer',
      marginBottom: theme.spacing(1),
      height: FLAMEGRAPH_CONTAINER_HEIGHT,
    }),
  };
}

export default FlameGraphContainer;
