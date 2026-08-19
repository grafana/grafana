import { css } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { escapeStringForRegex } from '@grafana/data';

import FlameGraphCallTreeContainer from './CallTree/FlameGraphCallTreeContainer';
import FlameGraph from './FlameGraph/FlameGraph';
import { type GetExtraContextMenuButtonsFunction } from './FlameGraph/FlameGraphContextMenu';
import { type FlameGraphDataContainer, type LevelItem } from './FlameGraph/dataTransform';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { FLAMEGRAPH_CONTAINER_HEIGHT } from './constants';
import { useColorScheme } from './hooks';
import { type ClickedItemData, PaneView, type ViewMode, type TextAlign } from './types';

type FlameGraphPaneProps = {
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
  viewMode: ViewMode;
  paneViewForContextMenu: PaneView;
  setSearch: (search: string) => void;
  resetKey?: number;
  keepFocusOnDataChange?: boolean;
  focusedItemIndexes?: number[];
  setFocusedItemIndexes?: (itemIndexes: number[] | undefined) => void;
  sharedSandwichItem?: string;
  setSharedSandwichItem?: (item: string | undefined) => void;
  loadingItems?: Set<LevelItem>;
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
  viewMode,
  paneViewForContextMenu,
  setSearch,
  resetKey,
  keepFocusOnDataChange,
  focusedItemIndexes,
  setFocusedItemIndexes,
  sharedSandwichItem,
  setSharedSandwichItem,
  loadingItems,
}: FlameGraphPaneProps) => {
  const [focusedItemData, setFocusedItemData] = useState<ClickedItemData>();
  // Call path of the focused item, recorded against the data it was focused in, so the focus can be restored on the
  // matching node when the data changes. See the effects below.
  const focusedItemPathRef = useRef<string[] | undefined>(undefined);
  // Set when this pane is the one moving the focus, so the effect syncing focus between panes skips that round.
  const weSetFocusRef = useRef(false);
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

  const styles = getStyles();

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
      // Prefer the node at the exact same call path: a label can occur at many call sites, and re-anchoring on the
      // first of them would silently move the focus to an unrelated part of the profile. Fall back to the label when
      // the path no longer exists, which keeps the focus roughly where it was for a node that merely moved.
      const item =
        (focusedItemPathRef.current && dataContainer.getItemByPath(focusedItemPathRef.current)) ||
        dataContainer.getNodesWithLabel(focusedItemData.label)?.[0];

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

  // Declared after the re-anchoring effect so that on a data change that effect still sees the path recorded against
  // the previous data, and this one then records the path of the re-anchored item.
  useEffect(() => {
    focusedItemPathRef.current =
      focusedItemData && focusedItemData.item.itemIndexes.length
        ? dataContainer?.getItemPath(focusedItemData.item)
        : undefined;
  }, [focusedItemData, dataContainer]);

  useEffect(() => {
    if (!focusedItemIndexes || focusedItemIndexes.length === 0) {
      return;
    }

    if (weSetFocusRef.current) {
      weSetFocusRef.current = false;
      return;
    }

    const currentIndexes = focusedItemData?.item.itemIndexes;
    if (currentIndexes && currentIndexes.length === focusedItemIndexes.length) {
      const matches = currentIndexes.every((val, idx) => val === focusedItemIndexes[idx]);
      if (matches) {
        return;
      }
    }

    const item = dataContainer.getItemByIndexes(focusedItemIndexes);
    if (item) {
      const totalViewTicks = dataContainer.getLevels()[0][0].value;

      setFocusedItemData({ label: dataContainer.getLabel(item.itemIndexes[0]), item, posX: 0, posY: 0 });
      setRangeMin(item.start / totalViewTicks);
      setRangeMax((item.start + item.value) / totalViewTicks);
    }
  }, [focusedItemIndexes, dataContainer, focusedItemData]);

  const resetFocus = useCallback(() => {
    setFocusedItemData(undefined);
    setRangeMin(0);
    setRangeMax(1);
    setFocusedItemIndexes?.(undefined);
  }, [setFocusedItemIndexes]);

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
            weSetFocusRef.current = true;
            setFocusedItemIndexes?.(data.item.itemIndexes);
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
          viewMode={viewMode}
          paneView={paneViewForContextMenu}
          search={search}
          collapsedMap={collapsedMap}
          setCollapsedMap={setCollapsedMap}
          loadingItems={loadingItems}
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
            search={search}
            onSearch={onCallTreeSearch}
            focusedItemIndexes={focusedItemIndexes}
            setFocusedItemIndexes={setFocusedItemIndexes}
            getExtraContextMenuButtons={getExtraContextMenuButtons}
            viewMode={viewMode}
            paneView={paneViewForContextMenu}
          />
        </div>
      );
      break;
  }

  return <div className={styles.paneWrapper}>{content}</div>;
};

function getStyles() {
  return {
    paneWrapper: css({
      width: '100%',
      height: '100%',
    }),
    tableContainer: css({
      height: FLAMEGRAPH_CONTAINER_HEIGHT,
      minWidth: 0,
      overflow: 'hidden',
    }),
  };
}

export default FlameGraphPane;
