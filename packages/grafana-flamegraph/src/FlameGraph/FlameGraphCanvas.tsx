// This component is based on logic from the flamebearer project
// https://github.com/mapbox/flamebearer

// ISC License

// Copyright (c) 2018, Mapbox

// Permission to use, copy, modify, and/or distribute this software for any purpose
// with or without fee is hereby granted, provided that the above copyright notice
// and this permission notice appear in all copies.

// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
// REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
// INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
// OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
// TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
// THIS SOFTWARE.
import { css } from '@emotion/css';
import React, { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';

import { PIXELS_PER_LEVEL } from '../constants';
import { ClickedItemData, ColorScheme, ColorSchemeDiff, TextAlign } from '../types';

import FlameGraphContextMenu from './FlameGraphContextMenu';
import FlameGraphTooltip from './FlameGraphTooltip';
import { CollapseConfig, CollapsedMap, FlameGraphDataContainer, LevelItem } from './dataTransform';
import { getBarX, useFlameRender } from './rendering';
import { useFlameRender2 } from './rendering2';

type Props = {
  data: FlameGraphDataContainer;
  collapsedMap: CollapsedMap;
  rangeMin: number;
  rangeMax: number;
  search: string;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
  style?: React.CSSProperties;
  onItemFocused: (data: ClickedItemData) => void;
  focusedItemData?: ClickedItemData;
  textAlign: TextAlign;
  onSandwich: (label: string) => void;
  colorScheme: ColorScheme | ColorSchemeDiff;
  getTheme: () => GrafanaTheme2;

  levels: LevelItem[][];
  root: LevelItem;
  direction: 'children' | 'parents';
  // Depth in number of levels
  depth: number;

  totalProfileTicks: number;
  totalProfileTicksRight?: number;
  totalViewTicks: number;
  setCollapsedMap: (collapsedMap: CollapsedMap) => void;
};

const FlameGraphCanvas = ({
  data,
  collapsedMap,
  rangeMin,
  rangeMax,
  search,
  setRangeMin,
  setRangeMax,
  onItemFocused,
  focusedItemData,
  textAlign,
  onSandwich,
  colorScheme,
  getTheme,
  levels,
  totalProfileTicks,
  totalProfileTicksRight,
  totalViewTicks,
  setCollapsedMap,
  root,
  direction,
  depth,
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
    levels,
    rangeMax,
    rangeMin,
    search,
    textAlign,
    totalViewTicks,
    // We need this so that if we have a diff profile and are in sandwich view we still show the same diff colors.
    totalColorTicks: data.isDiffFlamegraph() ? totalProfileTicks : totalViewTicks,
    totalTicksRight: totalProfileTicksRight,
    wrapperWidth,
    getTheme,
  });

  useFlameRender2({
    canvasRef: graphRef,
    colorScheme,
    data,
    focusedItemData,
    root,
    direction,
    depth,
    rangeMax,
    rangeMin,
    search,
    textAlign,
    totalViewTicks,
    // We need this so that if we have a diff profile and are in sandwich view we still show the same diff colors.
    totalColorTicks: data.isDiffFlamegraph() ? totalProfileTicks : totalViewTicks,
    totalTicksRight: totalProfileTicksRight,
    wrapperWidth,
    getTheme,
    collapsedMap,
  });

  const onGraphClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      setTooltipItem(undefined);
      const pixelsPerTick = graphRef.current!.clientWidth / totalViewTicks / (rangeMax - rangeMin);
      const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(
        { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        levels,
        pixelsPerTick,
        totalViewTicks,
        rangeMin
      );

      const item = convertPixelCoordinatesToBarCoordinates2(
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
      // if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
      if (item) {
        // const item = levels[levelIndex][barIndex];
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
    [data, rangeMin, rangeMax, totalViewTicks, levels, collapsedMap]
  );

  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>();
  const onGraphMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (clickedItemData === undefined) {
        setTooltipItem(undefined);
        setMousePosition(undefined);
        const pixelsPerTick = graphRef.current!.clientWidth / totalViewTicks / (rangeMax - rangeMin);
        const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(
          { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
          levels,
          pixelsPerTick,
          totalViewTicks,
          rangeMin
        );

        const item = convertPixelCoordinatesToBarCoordinates2(
          { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
          root,
          direction,
          depth,
          pixelsPerTick,
          totalViewTicks,
          rangeMin,
          collapsedMap
        );

        // if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
        if (item) {
          setMousePosition({ x: e.clientX, y: e.clientY });
          setTooltipItem(item);
        }
      }
    },
    [rangeMin, rangeMax, totalViewTicks, clickedItemData, levels, setMousePosition, collapsedMap]
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
        getTheme={getTheme}
        position={mousePosition}
        item={tooltipItem}
        data={data}
        totalTicks={totalViewTicks}
      />
      {clickedItemData && (
        <FlameGraphContextMenu
          itemData={clickedItemData}
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
            const newMap = new Map(collapsedMap);
            const collapsedConfig = collapsedMap.get(clickedItemData.item)!;
            const newConfig = { ...collapsedConfig, collapsed: false };
            for (const item of collapsedConfig.items) {
              newMap.set(item, newConfig);
            }
            setCollapsedMap(newMap);
          }}
          onCollapseGroup={() => {
            const newMap = new Map(collapsedMap);
            const collapsedConfig = collapsedMap.get(clickedItemData.item)!;
            const newConfig = { ...collapsedConfig, collapsed: true };
            for (const item of collapsedConfig.items) {
              newMap.set(item, newConfig);
            }
            setCollapsedMap(newMap);
          }}
        />
      )}
    </div>
  );
};

const getStyles = () => ({
  graph: css`
    label: graph;
    overflow: auto;
    height: 100%;
    flex-grow: 1;
    flex-basis: 50%;
  `,
  canvasContainer: css`
    label: canvasContainer;
    display: flex;
  `,
  canvasWrapper: css`
    label: canvasWrapper;
    cursor: pointer;
    flex: 1;
    overflow: hidden;
  `,
  sandwichMarker: css`
    label: sandwichMarker;
    writing-mode: vertical-lr;
    transform: rotate(180deg);
    overflow: hidden;
    white-space: nowrap;
  `,
  sandwichMarkerIcon: css`
    label: sandwichMarkerIcon;
    vertical-align: baseline;
  `,
});

const convertPixelCoordinatesToBarCoordinates2 = (
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
  console.time('convertPixelCoordinatesToBarCoordinates2');
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

  console.timeEnd('convertPixelCoordinatesToBarCoordinates2');
  return found;
};

// Convert pixel coordinates to bar coordinates in the levels array so that we can add mouse events like clicks to
// the canvas.
const convertPixelCoordinatesToBarCoordinates = (
  // position relative to the start of the graph
  pos: { x: number; y: number },
  levels: LevelItem[][],
  pixelsPerTick: number,
  totalTicks: number,
  rangeMin: number
) => {
  console.time('convertPixelCoordinatesToBarCoordinates');
  const levelIndex = Math.floor(pos.y / (PIXELS_PER_LEVEL / window.devicePixelRatio));
  const barIndex = getBarIndex(pos.x, levels[levelIndex], pixelsPerTick, totalTicks, rangeMin);
  console.timeEnd('convertPixelCoordinatesToBarCoordinates');
  return { levelIndex, barIndex };
};

/**
 * Binary search for a bar in a level, based on the X pixel coordinate. Useful for detecting which bar did user click
 * on.
 */
const getBarIndex = (x: number, level: LevelItem[], pixelsPerTick: number, totalTicks: number, rangeMin: number) => {
  if (level) {
    let start = 0;
    let end = level.length - 1;

    while (start <= end) {
      const midIndex = (start + end) >> 1;
      const startOfBar = getBarX(level[midIndex].start, totalTicks, rangeMin, pixelsPerTick);
      const startOfNextBar = getBarX(
        level[midIndex].start + level[midIndex].value,
        totalTicks,
        rangeMin,
        pixelsPerTick
      );

      if (startOfBar <= x && startOfNextBar >= x) {
        return midIndex;
      }

      if (startOfBar > x) {
        end = midIndex - 1;
      } else {
        start = midIndex + 1;
      }
    }
  }
  return -1;
};

export default FlameGraphCanvas;
