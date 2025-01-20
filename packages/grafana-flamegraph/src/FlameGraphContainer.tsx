import { css } from '@emotion/css';
import uFuzzy from '@leeoniya/ufuzzy';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import { useMeasure } from 'react-use';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { ThemeContext } from '@grafana/ui';

import FlameGraph from './FlameGraph/FlameGraph';
import { GetExtraContextMenuButtonsFunction } from './FlameGraph/FlameGraphContextMenu';
import { CollapsedMap, FlameGraphDataContainer } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from './constants';
import { ClickedItemData, ColorScheme, ColorSchemeDiff, SelectedView, TextAlign } from './types';

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
}: Props) => {
  const [focusedItemData, setFocusedItemData] = useState<ClickedItemData>();

  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedView, setSelectedView] = useState(SelectedView.Both);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
  // This is a label of the item because in sandwich view we group all items by label and present a merged graph
  const [sandwichItem, setSandwichItem] = useState<string>();
  const [collapsedMap, setCollapsedMap] = useState(new CollapsedMap());

  const theme = useMemo(() => getTheme(), [getTheme]);
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
      if (search === symbol) {
        setSearch('');
      } else {
        onTableSymbolClick?.(symbol);
        setSearch(symbol);
        resetFocus();
      }
    },
    [setSearch, resetFocus, onTableSymbolClick, search]
  );

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
      onSandwich={(label: string) => {
        resetFocus();
        setSandwichItem(label);
      }}
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
      onSearch={setSearch}
      onTableSort={onTableSort}
      colorScheme={colorScheme}
    />
  );

  let body;
  if (showFlameGraphOnly || selectedView === SelectedView.FlameGraph) {
    body = flameGraph;
  } else if (selectedView === SelectedView.TopTable) {
    body = <div className={styles.tableContainer}>{table}</div>;
  } else if (selectedView === SelectedView.Both) {
    if (vertical) {
      body = (
        <div>
          <div className={styles.verticalGraphContainer}>{flameGraph}</div>
          <div className={styles.verticalTableContainer}>{table}</div>
        </div>
      );
    } else {
      body = (
        <div className={styles.horizontalContainer}>
          <div className={styles.horizontalTableContainer}>{table}</div>
          <div className={styles.horizontalGraphContainer}>{flameGraph}</div>
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
          />
        )}

        <div className={styles.body}>{body}</div>
      </div>
    </ThemeContext.Provider>
  );
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

/**
 * Based on the search string it does a fuzzy search over all the unique labels, so we can highlight them later.
 */
function useLabelSearch(
  search: string | undefined,
  data: FlameGraphDataContainer | undefined
): Set<string> | undefined {
  return useMemo(() => {
    if (search && data) {
      const foundLabels = new Set<string>();
      let idxs = ufuzzy.filter(data.getUniqueLabels(), search);

      if (idxs) {
        for (let idx of idxs) {
          foundLabels.add(data.getUniqueLabels()[idx]);
        }
      }

      return foundLabels;
    }
    // In this case undefined means there was no search so no attempt to highlighting anything should be made.
    return undefined;
  }, [search, data]);
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

    tableContainer: css({
      // This is not ideal for dashboard panel where it creates a double scroll. In a panel it should be 100% but then
      // in explore we need a specific height.
      height: 800,
    }),

    horizontalContainer: css({
      label: 'horizontalContainer',
      display: 'flex',
      minHeight: 0,
      flexDirection: 'row',
      columnGap: theme.spacing(1),
      width: '100%',
    }),

    horizontalGraphContainer: css({
      flexBasis: '50%',
    }),

    horizontalTableContainer: css({
      flexBasis: '50%',
      maxHeight: 800,
    }),

    verticalGraphContainer: css({
      marginBottom: theme.spacing(1),
    }),

    verticalTableContainer: css({
      height: 800,
    }),
  };
}

export default FlameGraphContainer;
