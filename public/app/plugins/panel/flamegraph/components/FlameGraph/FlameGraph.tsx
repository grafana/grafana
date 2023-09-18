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
import React, { MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMeasure } from 'react-use';

import { Icon, useStyles2 } from '@grafana/ui';

import { PIXELS_PER_LEVEL } from '../../constants';
import { ClickedItemData, ColorScheme, ColorSchemeDiff, TextAlign } from '../types';

import FlameGraphContextMenu from './FlameGraphContextMenu';
import FlameGraphMetadata from './FlameGraphMetadata';
import FlameGraphTooltip from './FlameGraphTooltip';
import { FlameGraphDataContainer, LevelItem } from './dataTransform';
import { getBarX, useFlameRender } from './rendering';

type Props = {
  data: FlameGraphDataContainer;
  rangeMin: number;
  rangeMax: number;
  search: string;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
  style?: React.CSSProperties;
  onItemFocused: (data: ClickedItemData) => void;
  focusedItemData?: ClickedItemData;
  textAlign: TextAlign;
  sandwichItem?: string;
  onSandwich: (label: string) => void;
  onFocusPillClick: () => void;
  onSandwichPillClick: () => void;
  colorScheme: ColorScheme | ColorSchemeDiff;
};

const FlameGraph = ({
  data,
  rangeMin,
  rangeMax,
  search,
  setRangeMin,
  setRangeMax,
  onItemFocused,
  focusedItemData,
  textAlign,
  onSandwich,
  sandwichItem,
  onFocusPillClick,
  onSandwichPillClick,
  colorScheme,
}: Props) => {
  const styles = useStyles2(getStyles);

  const [levels, totalProfileTicks, totalProfileTicksRight, totalViewTicks, callersCount] = useMemo(() => {
    let levels = data.getLevels();
    let totalProfileTicks = levels.length ? levels[0][0].value : 0;
    let totalProfileTicksRight = levels.length ? levels[0][0].valueRight : undefined;
    let callersCount = 0;
    let totalViewTicks = totalProfileTicks;

    if (sandwichItem) {
      const [callers, callees] = data.getSandwichLevels(sandwichItem);
      levels = [...callers, [], ...callees];
      // We need this separate as in case of diff profile we to compute diff colors based on the original ticks.
      totalViewTicks = callees[0]?.[0]?.value ?? 0;
      callersCount = callers.length;
    }
    return [levels, totalProfileTicks, totalProfileTicksRight, totalViewTicks, callersCount];
  }, [data, sandwichItem]);

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

      // if clicking on a block in the canvas
      if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
        const item = levels[levelIndex][barIndex];
        setClickedItemData({
          posY: e.clientY,
          posX: e.clientX,
          item,
          level: levelIndex,
          label: data.getLabel(item.itemIndexes[0]),
        });
      } else {
        // if clicking on the canvas but there is no block beneath the cursor
        setClickedItemData(undefined);
      }
    },
    [data, rangeMin, rangeMax, totalViewTicks, levels]
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

        if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
          setMousePosition({ x: e.clientX, y: e.clientY });
          setTooltipItem(levels[levelIndex][barIndex]);
        }
      }
    },
    [rangeMin, rangeMax, totalViewTicks, clickedItemData, levels, setMousePosition]
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
      <FlameGraphMetadata
        data={data}
        focusedItem={focusedItemData}
        sandwichedLabel={sandwichItem}
        totalTicks={totalViewTicks}
        onFocusPillClick={onFocusPillClick}
        onSandwichPillClick={onSandwichPillClick}
      />
      <div className={styles.canvasContainer}>
        {sandwichItem && (
          <div>
            <div
              className={styles.sandwichMarker}
              style={{ height: (callersCount * PIXELS_PER_LEVEL) / window.devicePixelRatio }}
            >
              Callers
              <Icon className={styles.sandwichMarkerIcon} name={'arrow-down'} />
            </div>
            <div className={styles.sandwichMarker} style={{ marginTop: PIXELS_PER_LEVEL / window.devicePixelRatio }}>
              <Icon className={styles.sandwichMarkerIcon} name={'arrow-up'} />
              Callees
            </div>
          </div>
        )}
        <div className={styles.canvasWrapper} id="flameGraphCanvasContainer_clickOutsideCheck" ref={sizeRef}>
          <canvas
            ref={graphRef}
            data-testid="flameGraph"
            onClick={onGraphClick}
            onMouseMove={onGraphMouseMove}
            onMouseLeave={onGraphMouseLeave}
          />
        </div>
      </div>
      <FlameGraphTooltip position={mousePosition} item={tooltipItem} data={data} totalTicks={totalViewTicks} />
      {clickedItemData && (
        <FlameGraphContextMenu
          itemData={clickedItemData}
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
        />
      )}
    </div>
  );
};

const getStyles = () => ({
  graph: css`
    overflow: scroll;
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
    writing-mode: vertical-lr;
    transform: rotate(180deg);
    overflow: hidden;
    white-space: nowrap;
  `,
  sandwichMarkerIcon: css`
    vertical-align: baseline;
  `,
});

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
  const levelIndex = Math.floor(pos.y / (PIXELS_PER_LEVEL / window.devicePixelRatio));
  const barIndex = getBarIndex(pos.x, levels[levelIndex], pixelsPerTick, totalTicks, rangeMin);
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

export default FlameGraph;
