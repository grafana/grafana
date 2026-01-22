/**
 * NEW UI VERSION - Copy of ../FlameGraphContainer.tsx with significant modifications.
 *
 * Key changes from the legacy version:
 * - Complete redesign to support the new pane-based UI architecture
 * - State: Replaced `selectedView: SelectedView` with `viewMode: ViewMode` (Single/Split)
 * - State: Added `leftPaneView`, `rightPaneView`, `singleView` for managing pane contents
 * - State: Added `panesSwapped` for swap functionality, `focusedItemIndexes` for cross-pane sync
 * - State: Added `sharedSandwichItem` for cross-pane sandwich mode synchronization
 * - Renders FlameGraphPane components instead of directly rendering FlameGraph/TopTable
 * - Supports horizontal split layout with CSS order-based swapping
 * - Uses refs and stable callbacks to prevent unnecessary child re-renders
 *
 * When the new UI is stable, this file should replace ../FlameGraphContainer.tsx
 */

import { css } from '@emotion/css';
import uFuzzy from '@leeoniya/ufuzzy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';
import { useMeasure, usePrevious } from 'react-use';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { ThemeContext } from '@grafana/ui';

import { GetExtraContextMenuButtonsFunction } from './FlameGraph/FlameGraphContextMenu';
import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphPane from './FlameGraphPane';
import { MIN_WIDTH_FOR_SPLIT_VIEW } from '../constants';
import { PaneView, ViewMode } from '../types';
import { getAssistantContextFromDataFrame } from '../utils';

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
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
  const [leftPaneView, setLeftPaneView] = useState<PaneView>(PaneView.TopTable);
  const [rightPaneView, setRightPaneView] = useState<PaneView>(PaneView.FlameGraph);
  const [singleView, setSingleView] = useState<PaneView>(PaneView.FlameGraph);
  const [panesSwapped, setPanesSwapped] = useState(false);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const [resetKey, setResetKey] = useState(0);
  const [focusedItemIndexes, setFocusedItemIndexes] = useState<number[] | undefined>(undefined);
  const [sharedSandwichItem, setSharedSandwichItem] = useState<string | undefined>(undefined);

  // Determine if we can show Split view based on container width
  const canShowSplitView = containerWidth > 0 && (containerWidth >= MIN_WIDTH_FOR_SPLIT_VIEW || Boolean(vertical));

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

  // The effective view mode: force Single when container is too narrow for Split
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

  let body;
  if (showFlameGraphOnly) {
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
        viewMode={effectiveViewMode}
        paneViewForContextMenu={PaneView.FlameGraph}
        theme={theme}
        setSearch={setSearch}
        resetKey={resetKey}
        keepFocusOnDataChange={keepFocusOnDataChange}
        focusedItemIndexes={focusedItemIndexes}
        setFocusedItemIndexes={setFocusedItemIndexes}
        sharedSandwichItem={sharedSandwichItem}
        setSharedSandwichItem={setSharedSandwichItem}
      />
    );
  } else if (effectiveViewMode === ViewMode.Single) {
    body = (
      <FlameGraphPane
        paneView={singleView}
        dataContainer={dataContainer}
        search={search}
        matchedLabels={matchedLabels}
        onTableSymbolClick={stableOnTableSymbolClick}
        onTextAlignSelected={stableOnTextAlignSelected}
        onTableSort={stableOnTableSort}
        showFlameGraphOnly={showFlameGraphOnly}
        disableCollapsing={disableCollapsing}
        getExtraContextMenuButtons={getExtraContextMenuButtons}
        viewMode={ViewMode.Single}
        paneViewForContextMenu={singleView}
        theme={theme}
        setSearch={setSearch}
        resetKey={resetKey}
        keepFocusOnDataChange={keepFocusOnDataChange}
        focusedItemIndexes={focusedItemIndexes}
        setFocusedItemIndexes={setFocusedItemIndexes}
        sharedSandwichItem={sharedSandwichItem}
        setSharedSandwichItem={setSharedSandwichItem}
      />
    );
  } else {
    // Only sync sandwich mode between panes when they show different view types
    // (e.g., FlameGraph + CallTree). When both panes show the same type,
    // they should be independent for separate investigation.
    const shouldSyncSandwich = leftPaneView !== rightPaneView;

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
        viewMode={ViewMode.Split}
        paneViewForContextMenu={leftPaneView}
        theme={theme}
        setSearch={setSearch}
        resetKey={resetKey}
        keepFocusOnDataChange={keepFocusOnDataChange}
        focusedItemIndexes={focusedItemIndexes}
        setFocusedItemIndexes={setFocusedItemIndexes}
        sharedSandwichItem={shouldSyncSandwich ? sharedSandwichItem : undefined}
        setSharedSandwichItem={shouldSyncSandwich ? setSharedSandwichItem : undefined}
      />
    );

    const rightPane = (
      <FlameGraphPane
        key="right-pane"
        paneView={rightPaneView}
        dataContainer={dataContainer}
        search={search}
        matchedLabels={matchedLabels}
        onTableSymbolClick={stableOnTableSymbolClick}
        onTextAlignSelected={stableOnTextAlignSelected}
        onTableSort={stableOnTableSort}
        showFlameGraphOnly={showFlameGraphOnly}
        disableCollapsing={disableCollapsing}
        getExtraContextMenuButtons={getExtraContextMenuButtons}
        viewMode={ViewMode.Split}
        paneViewForContextMenu={rightPaneView}
        theme={theme}
        setSearch={setSearch}
        resetKey={resetKey}
        keepFocusOnDataChange={keepFocusOnDataChange}
        focusedItemIndexes={focusedItemIndexes}
        setFocusedItemIndexes={setFocusedItemIndexes}
        sharedSandwichItem={shouldSyncSandwich ? sharedSandwichItem : undefined}
        setSharedSandwichItem={shouldSyncSandwich ? setSharedSandwichItem : undefined}
      />
    );

    // Use CSS order to visually swap panes while keeping React tree stable
    // This preserves component state when swapping
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

    verticalContainer: css({
      label: 'verticalContainer',
      display: 'flex',
      flexDirection: 'column',
    }),

    horizontalPaneContainer: css({
      label: 'horizontalPaneContainer',
      flexBasis: '50%',
      maxHeight: 800,
      minWidth: 0,
      overflow: 'auto',
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
      overflow: 'auto',
    }),
  };
}

export default FlameGraphContainer;
