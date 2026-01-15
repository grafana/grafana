import { css } from '@emotion/css';
import uFuzzy from '@leeoniya/ufuzzy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';
import { useMeasure, usePrevious } from 'react-use';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { ThemeContext } from '@grafana/ui';

import { FlameGraphDataContainer } from './FlameGraph/dataTransform';
import { GetExtraContextMenuButtonsFunction } from './FlameGraph/FlameGraphContextMenu';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphPane from './FlameGraphPane';
import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from './constants';
import { PaneView, SelectedView, ViewMode } from './types';
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
   * If true, the assistant button will be shown in the header if available.
   * This is needed mainly for Profiles Drilldown where in some cases we need to hide the button to show alternative
   * option to use AI.
   * @default true
   */
  showAnalyzeWithAssistant?: boolean;
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
}: Props) => {
  const [search, setSearch] = useState('');
  const [selectedView, setSelectedView] = useState(SelectedView.Multi);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
  const [leftPaneView, setLeftPaneView] = useState<PaneView>(PaneView.TopTable);
  const [rightPaneView, setRightPaneView] = useState<PaneView>(PaneView.FlameGraph);
  const [singleView, setSingleView] = useState<PaneView>(PaneView.FlameGraph);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const [resetKey, setResetKey] = useState(0);
  const [viewBeforeNarrow, setViewBeforeNarrow] = useState<SelectedView | null>(null);
  const [highlightedItemIndexes, setHighlightedItemIndexes] = useState<number[] | undefined>(undefined);
  const [sharedSandwichItem, setSharedSandwichItem] = useState<string | undefined>(undefined);

  // Use refs and stable wrappers to prevent child re-renders when callbacks change
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

  const theme = useMemo(() => getTheme(), [getTheme]);
  const dataContainer = useMemo((): FlameGraphDataContainer | undefined => {
    if (!data) {
      return;
    }

    return new FlameGraphDataContainer(data, { collapsing: !disableCollapsing }, theme);
  }, [data, theme, disableCollapsing]);

  const styles = getStyles(theme);
  const matchedLabels = useLabelSearch(search, dataContainer);

  useEffect(() => {
    if (containerWidth === 0) {
      return;
    }

    const isNarrow = containerWidth < MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH && !vertical;

    if (isNarrow && selectedView === SelectedView.Multi) {
      setViewBeforeNarrow(SelectedView.Multi);
      const currentRightView = viewMode === ViewMode.Single ? singleView : rightPaneView;
      const narrowView =
        currentRightView === PaneView.TopTable
          ? SelectedView.TopTable
          : currentRightView === PaneView.CallTree
            ? SelectedView.CallTree
            : SelectedView.FlameGraph;
      setSelectedView(narrowView);
    } else if (!isNarrow && viewBeforeNarrow !== null) {
      setSelectedView(viewBeforeNarrow);
      setViewBeforeNarrow(null);
    }
  }, [containerWidth, vertical, selectedView, viewBeforeNarrow, viewMode, singleView, rightPaneView]);

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

  let body;
  if (showFlameGraphOnly || selectedView === SelectedView.FlameGraph) {
    body = (
      <FlameGraphPane
        paneView={PaneView.FlameGraph}
        dataContainer={dataContainer}
        search={search}
        matchedLabels={matchedLabels}
        onTableSymbolClick={stableOnTableSymbolClick}
        onTextAlignSelected={stableOnTextAlignSelected}
        onTableSort={stableOnTableSort}
        showFlameGraphOnly={showFlameGraphOnly}
        disableCollapsing={disableCollapsing}
        getExtraContextMenuButtons={getExtraContextMenuButtons}
        selectedView={selectedView}
        viewMode={viewMode}
        theme={theme}
        setSearch={setSearch}
        resetKey={resetKey}
        keepFocusOnDataChange={keepFocusOnDataChange}
        highlightedItemIndexes={highlightedItemIndexes}
        setHighlightedItemIndexes={setHighlightedItemIndexes}
        sharedSandwichItem={sharedSandwichItem}
        setSharedSandwichItem={setSharedSandwichItem}
      />
    );
  } else if (selectedView === SelectedView.TopTable) {
    body = (
      <FlameGraphPane
        paneView={PaneView.TopTable}
        dataContainer={dataContainer}
        search={search}
        matchedLabels={matchedLabels}
        onTableSymbolClick={stableOnTableSymbolClick}
        onTextAlignSelected={stableOnTextAlignSelected}
        onTableSort={stableOnTableSort}
        showFlameGraphOnly={showFlameGraphOnly}
        disableCollapsing={disableCollapsing}
        getExtraContextMenuButtons={getExtraContextMenuButtons}
        selectedView={selectedView}
        viewMode={viewMode}
        theme={theme}
        setSearch={setSearch}
        resetKey={resetKey}
        keepFocusOnDataChange={keepFocusOnDataChange}
        highlightedItemIndexes={highlightedItemIndexes}
        setHighlightedItemIndexes={setHighlightedItemIndexes}
        sharedSandwichItem={sharedSandwichItem}
        setSharedSandwichItem={setSharedSandwichItem}
      />
    );
  } else if (selectedView === SelectedView.CallTree) {
    body = (
      <FlameGraphPane
        paneView={PaneView.CallTree}
        dataContainer={dataContainer}
        search={search}
        matchedLabels={matchedLabels}
        onTableSymbolClick={stableOnTableSymbolClick}
        onTextAlignSelected={stableOnTextAlignSelected}
        onTableSort={stableOnTableSort}
        showFlameGraphOnly={showFlameGraphOnly}
        disableCollapsing={disableCollapsing}
        getExtraContextMenuButtons={getExtraContextMenuButtons}
        selectedView={selectedView}
        viewMode={viewMode}
        theme={theme}
        setSearch={setSearch}
        resetKey={resetKey}
        keepFocusOnDataChange={keepFocusOnDataChange}
        highlightedItemIndexes={highlightedItemIndexes}
        setHighlightedItemIndexes={setHighlightedItemIndexes}
        sharedSandwichItem={sharedSandwichItem}
        setSharedSandwichItem={setSharedSandwichItem}
      />
    );
  } else if (selectedView === SelectedView.Multi) {
    const isSplit = viewMode === ViewMode.Split;
    const rightSinglePaneView = isSplit ? rightPaneView : singleView;

    const leftPane = (
      <FlameGraphPane
        key="left-pane"
        paneView={leftPaneView}
        dataContainer={dataContainer}
        search={search}
        matchedLabels={matchedLabels}
        onTableSymbolClick={stableOnTableSymbolClick}
        onTextAlignSelected={stableOnTextAlignSelected}
        onTableSort={stableOnTableSort}
        showFlameGraphOnly={showFlameGraphOnly}
        disableCollapsing={disableCollapsing}
        getExtraContextMenuButtons={getExtraContextMenuButtons}
        selectedView={selectedView}
        viewMode={viewMode}
        theme={theme}
        setSearch={setSearch}
        resetKey={resetKey}
        keepFocusOnDataChange={keepFocusOnDataChange}
        highlightedItemIndexes={highlightedItemIndexes}
        setHighlightedItemIndexes={setHighlightedItemIndexes}
        sharedSandwichItem={sharedSandwichItem}
        setSharedSandwichItem={setSharedSandwichItem}
      />
    );

    const rightSinglePane = (
      <FlameGraphPane
        key="right-single-pane"
        paneView={rightSinglePaneView}
        dataContainer={dataContainer}
        search={search}
        matchedLabels={matchedLabels}
        onTableSymbolClick={stableOnTableSymbolClick}
        onTextAlignSelected={stableOnTextAlignSelected}
        onTableSort={stableOnTableSort}
        showFlameGraphOnly={showFlameGraphOnly}
        disableCollapsing={disableCollapsing}
        getExtraContextMenuButtons={getExtraContextMenuButtons}
        selectedView={selectedView}
        viewMode={viewMode}
        theme={theme}
        setSearch={setSearch}
        resetKey={resetKey}
        keepFocusOnDataChange={keepFocusOnDataChange}
        highlightedItemIndexes={highlightedItemIndexes}
        setHighlightedItemIndexes={setHighlightedItemIndexes}
        sharedSandwichItem={sharedSandwichItem}
        setSharedSandwichItem={setSharedSandwichItem}
      />
    );

    if (vertical) {
      body = (
        <div>
          {isSplit && <div className={styles.verticalPaneContainer}>{leftPane}</div>}
          <div
            key="right-single-container"
            className={isSplit ? styles.verticalPaneContainer : styles.singlePaneContainer}
          >
            {rightSinglePane}
          </div>
        </div>
      );
    } else {
      body = (
        <div className={styles.horizontalContainer}>
          {isSplit && <div className={styles.horizontalPaneContainer}>{leftPane}</div>}
          <div
            key="right-single-container"
            className={isSplit ? styles.horizontalPaneContainer : styles.singlePaneContainerHorizontal}
          >
            {rightSinglePane}
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
            selectedView={selectedView}
            setSelectedView={(view) => {
              setSelectedView(view);
              onViewSelected?.(view);
            }}
            viewMode={viewMode}
            setViewMode={setViewMode}
            leftPaneView={leftPaneView}
            setLeftPaneView={setLeftPaneView}
            rightPaneView={rightPaneView}
            setRightPaneView={setRightPaneView}
            singleView={singleView}
            setSingleView={setSingleView}
            containerWidth={containerWidth}
            onReset={() => {
              setSearch('');
              setHighlightedItemIndexes(undefined);
              setSharedSandwichItem(undefined);
              setResetKey((k) => k + 1);
            }}
            showResetButton={Boolean(search)}
            stickyHeader={Boolean(stickyHeader)}
            extraHeaderElements={extraHeaderElements}
            vertical={vertical}
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
export function useLabelSearch(
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
    }),

    horizontalContainer: css({
      label: 'horizontalContainer',
      display: 'flex',
      minHeight: 0,
      flexDirection: 'row',
      columnGap: theme.spacing(1),
      width: '100%',
    }),

    horizontalPaneContainer: css({
      label: 'horizontalPaneContainer',
      flexBasis: '50%',
      maxHeight: 800,
      minWidth: 0,
      overflow: 'hidden',
    }),

    verticalPaneContainer: css({
      label: 'verticalPaneContainer',
      marginBottom: theme.spacing(1),
      height: 800,
    }),

    singlePaneContainer: css({
      label: 'singlePaneContainer',
      height: 800,
    }),

    singlePaneContainerHorizontal: css({
      label: 'singlePaneContainerHorizontal',
      flexBasis: '100%',
      maxHeight: 800,
      minWidth: 0,
      overflow: 'hidden',
    }),
  };
}

export default FlameGraphContainer;
