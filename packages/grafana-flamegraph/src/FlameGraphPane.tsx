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
  const [focusedItemData, setFocusedItemData] = useState<ClickedItemData>();
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(1);
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
  const [localSandwichItem, setLocalSandwichItem] = useState<string>();

  const isUsingSharedSandwich = setSharedSandwichItem !== undefined;
  const sandwichItem = isUsingSharedSandwich ? sharedSandwichItem : localSandwichItem;
  const setSandwichItem = useCallback(
    (item: string | undefined) => {
      if (isUsingSharedSandwich && setSharedSandwichItem) {
        setSharedSandwichItem(item);
      } else {
        setLocalSandwichItem(item);
      }
    },
    [isUsingSharedSandwich, setSharedSandwichItem]
  );
  const [collapsedMap, setCollapsedMap] = useState(() => dataContainer.getCollapsedMap());
  const [colorScheme, setColorScheme] = useColorScheme(dataContainer);

  const styles = useMemo(() => getStyles(theme), [theme]);

  // useLayoutEffect ensures collapsed state is applied before browser paint
  useLayoutEffect(() => {
    setCollapsedMap(dataContainer.getCollapsedMap());
  }, [dataContainer]);

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setFocusedItemData(undefined);
      setRangeMin(0);
      setRangeMax(1);
      setLocalSandwichItem(undefined);
    }
  }, [resetKey]);

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
  }, [setSandwichItem]);

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

  const onCallTreeSymbolClick = useCallback(
    (symbol: string) => {
      onTableSymbolClick?.(symbol);
    },
    [onTableSymbolClick]
  );

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

  const onTopTableSearch = useCallback(
    (str: string) => {
      if (!str) {
        setSearch('');
        return;
      }
      setSearch(`^${escapeStringForRegex(str)}$`);
    },
    [setSearch]
  );

  let content;
  switch (paneView) {
    case PaneView.TopTable:
      content = (
        <div className={styles.tableContainer}>
          <FlameGraphTopTableContainer
            data={dataContainer}
            onSymbolClick={onSymbolClick}
            search={search}
            matchedLabels={matchedLabels}
            sandwichItem={sandwichItem}
            onSandwich={setSandwichItem}
            onSearch={onTopTableSearch}
            onTableSort={onTableSort}
            colorScheme={colorScheme}
          />
        </div>
      );
      break;
    case PaneView.FlameGraph:
    default:
      content = (
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
      break;
    case PaneView.CallTree:
      content = (
        <div className={styles.tableContainer}>
          <FlameGraphCallTreeContainer
            data={dataContainer}
            onSymbolClick={onCallTreeSymbolClick}
            sandwichItem={sandwichItem}
            onSandwich={setSandwichItem}
            onTableSort={onTableSort}
            colorScheme={colorScheme}
            search={search}
            onSearch={onCallTreeSearch}
            highlightedItemIndexes={highlightedItemIndexes}
          />
        </div>
      );
      break;
  }

  return <div className={styles.paneWrapper}>{content}</div>;
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
    paneWrapper: css({
      width: '100%',
      height: '100%',
    }),
    tableContainer: css({
      // This is not ideal for dashboard panel where it creates a double scroll. In a panel it should be 100% but then
      // in explore we need a specific height.
      height: 800,
      minWidth: 0, // Allow shrinking below content size in flex layout
      overflow: 'hidden',
    }),
  };
}

export default FlameGraphPane;
