import { css } from '@emotion/css';
import React, { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMeasure } from 'react-use';

import { PIXELS_PER_LEVEL } from '../constants';
import { ClickedItemData, ColorScheme, ColorSchemeDiff, SelectedView, TextAlign } from '../types';

import FlameGraphContextMenu, { GetExtraContextMenuButtonsFunction } from './FlameGraphContextMenu';
import FlameGraphTooltip from './FlameGraphTooltip';
import { CollapseConfig, CollapsedMap, FlameGraphDataContainer, LevelItem } from './dataTransform';
import { getBarX, useFlameRender } from './rendering';

type Props = {
  data: FlameGraphDataContainer;
  rangeMin: number;
  rangeMax: number;
  matchedLabels: Set<string> | undefined;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
  style?: React.CSSProperties;
  onItemFocused: (data: ClickedItemData) => void;
  focusedItemData?: ClickedItemData;
  textAlign: TextAlign;
  onSandwich: (label: string) => void;
  colorScheme: ColorScheme | ColorSchemeDiff;

  root: LevelItem;
  direction: 'children' | 'parents';
  // Depth in number of levels
  depth: number;

  totalProfileTicks: number;
  totalProfileTicksRight?: number;
  totalViewTicks: number;
  showFlameGraphOnly?: boolean;

  collapsedMap: CollapsedMap;
  setCollapsedMap: (collapsedMap: CollapsedMap) => void;
  collapsing?: boolean;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;

  selectedView: SelectedView;
  search: string;
};

const FlameGraphCanvas = ({
  data,
  rangeMin,
  rangeMax,
  matchedLabels,
  setRangeMin,
  setRangeMax,
  onItemFocused,
  focusedItemData,
  textAlign,
  onSandwich,
  colorScheme,
  totalProfileTicks,
  totalProfileTicksRight,
  totalViewTicks,
  root,
  direction,
  depth,
  showFlameGraphOnly,
  collapsedMap,
  setCollapsedMap,
  collapsing,
  getExtraContextMenuButtons,
  selectedView,
  search,
}: Props) => {
  const styles = getStyles();

  const [sizeRef, { width: wrapperWidth }] = useMeasure<HTMLDivElement>();
  const graphRef = useRef<HTMLCanvasElement>(null);
  const [tooltipItem, setTooltipItem] = useState<LevelItem>();

  const [clickedItemData, setClickedItemData] = useState<ClickedItemData>();

  useFlameRender({
    canvasRef: graphRef,
    colorScheme,
    data,
    focusedItemData,
    root,
    direction,
    depth,
    rangeMax,
    rangeMin,
    matchedLabels,
    textAlign,
    totalViewTicks,
    // We need this so that if we have a diff profile and are in sandwich view we still show the same diff colors.
    totalColorTicks: data.isDiffFlamegraph() ? totalProfileTicks : totalViewTicks,
    totalTicksRight: totalProfileTicksRight,
    wrapperWidth,
    collapsedMap,
  });

  const onGraphClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      setTooltipItem(undefined);
      const pixelsPerTick = graphRef.current!.clientWidth / totalViewTicks / (rangeMax - rangeMin);
      const item = convertPixelCoordinatesToBarCoordinates(
        { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        root,
        direction,
        depth,
        pixelsPerTick,
        totalViewTicks,
        rangeMin,
        collapsedMap
      );

      // if clicking on a block in the canvas
      if (item) {
        setClickedItemData({
          posY: e.clientY,
          posX: e.clientX,
          item,
          label: data.getLabel(item.itemIndexes[0]),
        });
      } else {
        // if clicking on the canvas but there is no block beneath the cursor
        setClickedItemData(undefined);
      }
    },
    [data, rangeMin, rangeMax, totalViewTicks, root, direction, depth, collapsedMap]
  );

  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>();
  const onGraphMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (clickedItemData === undefined) {
        setTooltipItem(undefined);
        setMousePosition(undefined);
        const pixelsPerTick = graphRef.current!.clientWidth / totalViewTicks / (rangeMax - rangeMin);
        const item = convertPixelCoordinatesToBarCoordinates(
          { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
          root,
          direction,
          depth,
          pixelsPerTick,
          totalViewTicks,
          rangeMin,
          collapsedMap
        );

        if (item) {
          setMousePosition({ x: e.clientX, y: e.clientY });
          setTooltipItem(item);
        }
      }
    },
    [rangeMin, rangeMax, totalViewTicks, clickedItemData, setMousePosition, root, direction, depth, collapsedMap]
  );

  const onGraphMouseLeave = useCallback(() => {
    setTooltipItem(undefined);
  }, []);

  // hide context menu if outside the flame graph canvas is clicked
  useEffect(() => {
    const handleOnClick = (e: MouseEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.parentElement?.id !== 'flameGraphCanvasContainer_clickOutsideCheck'
      ) {
        setClickedItemData(undefined);
      }
    };
    window.addEventListener('click', handleOnClick);
    return () => window.removeEventListener('click', handleOnClick);
  }, [setClickedItemData]);

  return (
    <div className={styles.graph}>
      <div className={styles.canvasWrapper} id="flameGraphCanvasContainer_clickOutsideCheck" ref={sizeRef}>
        <canvas
          ref={graphRef}
          data-testid="flameGraph"
          onClick={onGraphClick}
          onMouseMove={onGraphMouseMove}
          onMouseLeave={onGraphMouseLeave}
        />
      </div>
      <FlameGraphTooltip
        position={mousePosition}
        item={tooltipItem}
        data={data}
        totalTicks={totalViewTicks}
        collapseConfig={tooltipItem ? collapsedMap.get(tooltipItem) : undefined}
      />
      {!showFlameGraphOnly && clickedItemData && (
        <FlameGraphContextMenu
          data={data}
          itemData={clickedItemData}
          collapsing={collapsing}
          collapseConfig={collapsedMap.get(clickedItemData.item)}
          onMenuItemClick={() => {
            setClickedItemData(undefined);
          }}
          onItemFocus={() => {
            setRangeMin(clickedItemData.item.start / totalViewTicks);
            setRangeMax((clickedItemData.item.start + clickedItemData.item.value) / totalViewTicks);
            onItemFocused(clickedItemData);
          }}
          onSandwich={() => {
            onSandwich(data.getLabel(clickedItemData.item.itemIndexes[0]));
          }}
          onExpandGroup={() => {
            setCollapsedMap(setCollapsedStatus(collapsedMap, clickedItemData.item, false));
          }}
          onCollapseGroup={() => {
            setCollapsedMap(setCollapsedStatus(collapsedMap, clickedItemData.item, true));
          }}
          onExpandAllGroups={() => {
            setCollapsedMap(setAllCollapsedStatus(collapsedMap, false));
          }}
          onCollapseAllGroups={() => {
            setCollapsedMap(setAllCollapsedStatus(collapsedMap, true));
          }}
          allGroupsCollapsed={Array.from(collapsedMap.values()).every((i) => i.collapsed)}
          allGroupsExpanded={Array.from(collapsedMap.values()).every((i) => !i.collapsed)}
          getExtraContextMenuButtons={getExtraContextMenuButtons}
          selectedView={selectedView}
          search={search}
        />
      )}
    </div>
  );
};

function setCollapsedStatus(collapsedMap: CollapsedMap, item: LevelItem, collapsed: boolean) {
  const newMap = new Map(collapsedMap);
  const collapsedConfig = collapsedMap.get(item)!;
  const newConfig = { ...collapsedConfig, collapsed };
  for (const item of collapsedConfig.items) {
    newMap.set(item, newConfig);
  }
  return newMap;
}

function setAllCollapsedStatus(collapsedMap: CollapsedMap, collapsed: boolean) {
  const newMap = new Map(collapsedMap);
  for (const item of collapsedMap.keys()) {
    const collapsedConfig = collapsedMap.get(item)!;
    const newConfig = { ...collapsedConfig, collapsed };
    newMap.set(item, newConfig);
  }

  return newMap;
}

const getStyles = () => ({
  graph: css({
    label: 'graph',
    overflow: 'auto',
    flexGrow: 1,
    flexBasis: '50%',
  }),
  canvasContainer: css({
    label: 'canvasContainer',
    display: 'flex',
  }),
  canvasWrapper: css({
    label: 'canvasWrapper',
    cursor: 'pointer',
    flex: 1,
    overflow: 'hidden',
  }),
  sandwichMarker: css({
    label: 'sandwichMarker',
    writingMode: 'vertical-lr',
    transform: 'rotate(180deg)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  }),
  sandwichMarkerIcon: css({
    label: 'sandwichMarkerIcon',
    verticalAlign: 'baseline',
  }),
});

export const convertPixelCoordinatesToBarCoordinates = (
  // position relative to the start of the graph
  pos: { x: number; y: number },
  root: LevelItem,
  direction: 'children' | 'parents',
  depth: number,
  pixelsPerTick: number,
  totalTicks: number,
  rangeMin: number,
  collapsedMap: Map<LevelItem, CollapseConfig>
): LevelItem | undefined => {
  let next: LevelItem | undefined = root;
  let currentLevel = direction === 'children' ? 0 : depth - 1;
  const levelIndex = Math.floor(pos.y / (PIXELS_PER_LEVEL / window.devicePixelRatio));
  let found = undefined;

  while (next) {
    const node: LevelItem = next;
    next = undefined;
    if (currentLevel === levelIndex) {
      found = node;
      break;
    }

    const nextList = direction === 'children' ? node.children : node.parents || [];

    for (const child of nextList) {
      const xStart = getBarX(child.start, totalTicks, rangeMin, pixelsPerTick);
      const xEnd = getBarX(child.start + child.value, totalTicks, rangeMin, pixelsPerTick);
      if (xStart <= pos.x && pos.x < xEnd) {
        next = child;
        // Check if item is a collapsed item. if so also check if the item is the first collapsed item in the chain,
        // which we render, or a child which we don't render. If it's a child in the chain then don't increase the
        // level end effectively skip it.
        const collapsedConfig = collapsedMap.get(child);
        if (!collapsedConfig || !collapsedConfig.collapsed || collapsedConfig.items[0] === child) {
          currentLevel = currentLevel + (direction === 'children' ? 1 : -1);
        }
        break;
      }
    }
  }

  return found;
};

export default FlameGraphCanvas;
