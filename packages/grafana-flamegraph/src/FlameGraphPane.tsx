import { css } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, escapeStringForRegex } from '@grafana/data';

import FlameGraphCallTreeContainer from './CallTree/FlameGraphCallTreeContainer';
import FlameGraph from './FlameGraph/FlameGraph';
import { GetExtraContextMenuButtonsFunction } from './FlameGraph/FlameGraphContextMenu';
import { FlameGraphDataContainer } from './FlameGraph/dataTransform';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { ClickedItemData, ColorScheme, ColorSchemeDiff, PaneView, SelectedView, TextAlign, ViewMode } from './types';

export type FlameGraphPaneProps = {
  paneView: PaneView;
  dataContainer: FlameGraphDataContainer;
  search: string;
  matchedLabels: Set<string> | undefined;
  onTableSymbolClick?: (symbol: string) => void;
  onTextAlignSelected?: (align: string) => void;
  onTableSort?: (sort: string) => void;
  showFlameGraphOnly?: boolean;
  disableCollapsing?: boolean;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;
  selectedView: SelectedView;
  viewMode: ViewMode;
  theme: GrafanaTheme2;
  setSearch: (search: string) => void;
  /** When this key changes, the pane's internal state (focus, sandwich, etc.) will be reset */
  resetKey?: number;
  /** Whether to preserve focus when the data changes */
  keepFocusOnDataChange?: boolean;
  /** Item indexes of the focused item in the flame graph, for cross-pane highlighting (e.g., in CallTree) */
  highlightedItemIndexes?: number[];
  /** Callback to set the highlighted item indexes when a node is focused in the flame graph */
  setHighlightedItemIndexes?: (itemIndexes: number[] | undefined) => void;
  /** Shared sandwich item for cross-pane synchronization */
  sharedSandwichItem?: string;
  /** Callback to set the shared sandwich item */
  setSharedSandwichItem?: (item: string | undefined) => void;
};

const FlameGraphPane = ({
  paneView,
  dataContainer,
  search,
  matchedLabels,
  onTableSymbolClick,
  onTextAlignSelected,
  onTableSort,
  showFlameGraphOnly,
  disableCollapsing,
  getExtraContextMenuButtons,
  selectedView,
  viewMode,
  theme,
  setSearch,
  resetKey,
  keepFocusOnDataChange,
  highlightedItemIndexes,
  setHighlightedItemIndexes,
  sharedSandwichItem,
  setSharedSandwichItem,
}: FlameGraphPaneProps) => {
  // Pane-specific state - each instance maintains its own
  const [focusedItemData, setFocusedItemData] = useState<ClickedItemData>();
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(1);
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
  const [localSandwichItem, setLocalSandwichItem] = useState<string>();

  // Use shared sandwich state when the setter is provided (indicates parent wants to manage state)
  // Otherwise use local state
  const isUsingSharedSandwich = setSharedSandwichItem !== undefined;
  const sandwichItem = isUsingSharedSandwich ? sharedSandwichItem : localSandwichItem;
  const setSandwichItem = useCallback((item: string | undefined) => {
    if (isUsingSharedSandwich && setSharedSandwichItem) {
      setSharedSandwichItem(item);
    } else {
      setLocalSandwichItem(item);
    }
  }, [isUsingSharedSandwich, setSharedSandwichItem]);
  // Initialize collapsedMap from dataContainer to ensure collapsed groups are shown correctly on first render
  const [collapsedMap, setCollapsedMap] = useState(() => dataContainer.getCollapsedMap());
  const [colorScheme, setColorScheme] = useColorScheme(dataContainer);

  const styles = useMemo(() => getStyles(theme), [theme]);

  // Re-initialize collapsed map when dataContainer changes (e.g., new data loaded)
  // Using useLayoutEffect to ensure collapsed state is applied before browser paint
  useLayoutEffect(() => {
    setCollapsedMap(dataContainer.getCollapsedMap());
  }, [dataContainer]);

  // Reset internal state when resetKey changes (triggered by parent's reset button)
  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setFocusedItemData(undefined);
      setRangeMin(0);
      setRangeMax(1);
      // Reset local sandwich state (shared state is reset by parent)
      setLocalSandwichItem(undefined);
    }
  }, [resetKey]);

  // Handle focus preservation or reset when data changes
  useEffect(() => {
    if (!keepFocusOnDataChange) {
      setFocusedItemData(undefined);
      setRangeMin(0);
      setRangeMax(1);
      setSandwichItem(undefined);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataContainer, keepFocusOnDataChange]);

  const resetFocus = useCallback(() => {
    setFocusedItemData(undefined);
    setRangeMin(0);
    setRangeMax(1);
    setHighlightedItemIndexes?.(undefined);
  }, [setHighlightedItemIndexes]);

  const resetSandwich = useCallback(() => {
    setSandwichItem(undefined);
  }, []);

  const onSymbolClick = useCallback(
    (symbol: string) => {
      const anchored = `^${escapeStringForRegex(symbol)}$`;
      if (search === anchored) {
        setSearch('');
      } else {
        onTableSymbolClick?.(symbol);
        setSearch(anchored);
        resetFocus();
      }
    },
    [search, setSearch, resetFocus, onTableSymbolClick]
  );

  // Separate callback for CallTree that doesn't trigger search
  const onCallTreeSymbolClick = useCallback(
    (symbol: string) => {
      onTableSymbolClick?.(symbol);
    },
    [onTableSymbolClick]
  );

  // Search callback for CallTree search button
  const onCallTreeSearch = useCallback(
    (symbol: string) => {
      const anchored = `^${escapeStringForRegex(symbol)}$`;
      if (search === anchored) {
        setSearch('');
      } else {
        onTableSymbolClick?.(symbol);
        setSearch(anchored);
        resetFocus();
      }
    },
    [search, setSearch, resetFocus, onTableSymbolClick]
  );

  const isInSplitView = selectedView === SelectedView.Multi && viewMode === ViewMode.Split;
  const isCallTreeInSplitView = isInSplitView && paneView === PaneView.CallTree;

  switch (paneView) {
    case PaneView.TopTable:
      return (
        <div className={styles.tableContainer}>
          <FlameGraphTopTableContainer
            data={dataContainer}
            onSymbolClick={onSymbolClick}
            search={search}
            matchedLabels={matchedLabels}
            sandwichItem={sandwichItem}
            onSandwich={setSandwichItem}
            onSearch={(str) => {
              if (!str) {
                setSearch('');
                return;
              }
              setSearch(`^${escapeStringForRegex(str)}$`);
            }}
            onTableSort={onTableSort}
            colorScheme={colorScheme}
          />
        </div>
      );
    case PaneView.FlameGraph:
    default:
      return (
        <FlameGraph
          data={dataContainer}
          rangeMin={rangeMin}
          rangeMax={rangeMax}
          matchedLabels={matchedLabels}
          setRangeMin={setRangeMin}
          setRangeMax={setRangeMax}
          onItemFocused={(data) => {
            setFocusedItemData(data);
            setHighlightedItemIndexes?.(data.item.itemIndexes);
          }}
          focusedItemData={focusedItemData}
          textAlign={textAlign}
          onTextAlignChange={(align) => {
            setTextAlign(align);
            onTextAlignSelected?.(align);
          }}
          sandwichItem={sandwichItem}
          onSandwich={(label: string) => {
            resetFocus();
            setSandwichItem(label);
          }}
          onFocusPillClick={resetFocus}
          onSandwichPillClick={resetSandwich}
          colorScheme={colorScheme}
          onColorSchemeChange={setColorScheme}
          isDiffMode={dataContainer.isDiffFlamegraph()}
          showFlameGraphOnly={showFlameGraphOnly}
          collapsing={!disableCollapsing}
          getExtraContextMenuButtons={getExtraContextMenuButtons}
          selectedView={selectedView}
          search={search}
          collapsedMap={collapsedMap}
          setCollapsedMap={setCollapsedMap}
        />
      );
    case PaneView.CallTree:
      return (
        <div className={styles.tableContainer}>
          <FlameGraphCallTreeContainer
            data={dataContainer}
            onSymbolClick={onCallTreeSymbolClick}
            sandwichItem={sandwichItem}
            onSandwich={setSandwichItem}
            onTableSort={onTableSort}
            colorScheme={colorScheme}
            search={search}
            compact={isCallTreeInSplitView}
            onSearch={onCallTreeSearch}
            highlightedItemIndexes={highlightedItemIndexes}
          />
        </div>
      );
  }
};

function useColorScheme(dataContainer: FlameGraphDataContainer | undefined) {
  const defaultColorScheme = dataContainer?.isDiffFlamegraph() ? ColorSchemeDiff.Default : ColorScheme.PackageBased;
  const [colorScheme, setColorScheme] = useState<ColorScheme | ColorSchemeDiff>(defaultColorScheme);

  // This makes sure that if we change the data to/from diff profile we reset the color scheme.
  useEffect(() => {
    setColorScheme(defaultColorScheme);
  }, [defaultColorScheme]);

  return [colorScheme, setColorScheme] as const;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    tableContainer: css({
      // This is not ideal for dashboard panel where it creates a double scroll. In a panel it should be 100% but then
      // in explore we need a specific height.
      height: 800,
    }),
  };
}

export default FlameGraphPane;
