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
import uFuzzy from '@leeoniya/ufuzzy';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMeasure } from 'react-use';

import { CoreApp } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PIXELS_PER_LEVEL } from '../../constants';
import { SelectedView, ContextMenuData } from '../types';

import FlameGraphContextMenu from './FlameGraphContextMenu';
import FlameGraphMetadata from './FlameGraphMetadata';
import FlameGraphTooltip from './FlameGraphTooltip';
import { FlameGraphDataContainer, LevelItem } from './dataTransform';
import { getBarX, getRectDimensionsForLevel, renderRect } from './rendering';

type Props = {
  data: FlameGraphDataContainer;
  app: CoreApp;
  levels: LevelItem[][];
  topLevelIndex: number;
  selectedBarIndex: number;
  rangeMin: number;
  rangeMax: number;
  search: string;
  setTopLevelIndex: (level: number) => void;
  setSelectedBarIndex: (bar: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
  selectedView: SelectedView;
  style?: React.CSSProperties;
};

const FlameGraph = ({
  data,
  app,
  levels,
  topLevelIndex,
  selectedBarIndex,
  rangeMin,
  rangeMax,
  search,
  setTopLevelIndex,
  setSelectedBarIndex,
  setRangeMin,
  setRangeMax,
  selectedView,
}: Props) => {
  const styles = useStyles2(getStyles);
  const totalTicks = data.getValue(0);

  const [sizeRef, { width: wrapperWidth }] = useMeasure<HTMLDivElement>();
  const graphRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipItem, setTooltipItem] = useState<LevelItem>();
  const [contextMenuData, setContextMenuData] = useState<ContextMenuData>();

  const [ufuzzy] = useState(() => {
    return new uFuzzy();
  });

  const foundLabels = useMemo(() => {
    const foundLabels = new Set<string>();

    if (search) {
      let idxs = ufuzzy.filter(data.getUniqueLabels(), search);

      if (idxs) {
        for (let idx of idxs) {
          foundLabels.add(data.getUniqueLabels()[idx]);
        }
      }
    }

    return foundLabels;
  }, [ufuzzy, search, data]);

  useEffect(() => {
    if (!levels.length) {
      return;
    }
    const pixelsPerTick = (wrapperWidth * window.devicePixelRatio) / totalTicks / (rangeMax - rangeMin);
    const ctx = graphRef.current?.getContext('2d')!;
    const graph = graphRef.current!;

    const height = PIXELS_PER_LEVEL * levels.length;
    graph.width = Math.round(wrapperWidth * window.devicePixelRatio);
    graph.height = Math.round(height * window.devicePixelRatio);
    graph.style.width = `${wrapperWidth}px`;
    graph.style.height = `${height}px`;

    ctx.textBaseline = 'middle';
    ctx.font = 12 * window.devicePixelRatio + 'px monospace';
    ctx.strokeStyle = 'white';

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
      const level = levels[levelIndex];
      // Get all the dimensions of the rectangles for the level. We do this by level instead of per rectangle, because
      // sometimes we collapse multiple bars into single rect.
      const dimensions = getRectDimensionsForLevel(data, level, levelIndex, totalTicks, rangeMin, pixelsPerTick);
      for (const rect of dimensions) {
        // Render each rectangle based on the computed dimensions
        renderRect(ctx, rect, totalTicks, rangeMin, rangeMax, search, levelIndex, topLevelIndex, foundLabels);
      }
    }
  }, [data, levels, wrapperWidth, totalTicks, rangeMin, rangeMax, search, topLevelIndex, foundLabels]);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.onclick = (e) => {
        setTooltipItem(undefined);
        const pixelsPerTick = graphRef.current!.clientWidth / totalTicks / (rangeMax - rangeMin);
        const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(
          data,
          e,
          pixelsPerTick,
          levels,
          totalTicks,
          rangeMin
        );

        // if clicking on a block in the canvas
        if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
          setContextMenuData({ e, levelIndex, barIndex });
        } else {
          // if clicking on the canvas but there is no block beneath the cursor
          setContextMenuData(undefined);
        }
      };

      graphRef.current!.onmousemove = (e) => {
        if (tooltipRef.current && contextMenuData === undefined) {
          setTooltipItem(undefined);
          const pixelsPerTick = graphRef.current!.clientWidth / totalTicks / (rangeMax - rangeMin);
          const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(
            data,
            e,
            pixelsPerTick,
            levels,
            totalTicks,
            rangeMin
          );

          if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
            tooltipRef.current.style.left = e.clientX + 10 + 'px';
            tooltipRef.current.style.top = e.clientY + 'px';
            setTooltipItem(levels[levelIndex][barIndex]);
          }
        }
      };

      graphRef.current!.onmouseleave = () => {
        setTooltipItem(undefined);
      };
    }
  }, [
    data,
    levels,
    rangeMin,
    rangeMax,
    topLevelIndex,
    totalTicks,
    wrapperWidth,
    setTopLevelIndex,
    setRangeMin,
    setRangeMax,
    selectedView,
    setSelectedBarIndex,
    setContextMenuData,
    contextMenuData,
  ]);

  // hide context menu if outside the flame graph canvas is clicked
  useEffect(() => {
    const handleOnClick = (e: MouseEvent) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if ((e.target as HTMLElement).parentElement?.id !== 'flameGraphCanvasContainer') {
        setContextMenuData(undefined);
      }
    };
    window.addEventListener('click', handleOnClick);
    return () => window.removeEventListener('click', handleOnClick);
  }, [setContextMenuData]);

  return (
    <div className={styles.graph} ref={sizeRef}>
      <FlameGraphMetadata
        data={data}
        levels={levels}
        topLevelIndex={topLevelIndex}
        selectedBarIndex={selectedBarIndex}
        totalTicks={totalTicks}
      />
      <div className={styles.canvasContainer} id="flameGraphCanvasContainer">
        <canvas ref={graphRef} data-testid="flameGraph" />
      </div>
      <FlameGraphTooltip tooltipRef={tooltipRef} item={tooltipItem} data={data} totalTicks={totalTicks} />
      {contextMenuData && (
        <FlameGraphContextMenu
          data={data}
          contextMenuData={contextMenuData!}
          levels={levels}
          totalTicks={totalTicks}
          graphRef={graphRef}
          setContextMenuData={setContextMenuData}
          setTopLevelIndex={setTopLevelIndex}
          setSelectedBarIndex={setSelectedBarIndex}
          setRangeMin={setRangeMin}
          setRangeMax={setRangeMax}
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
    cursor: pointer;
  `,
});

// Convert pixel coordinates to bar coordinates in the levels array so that we can add mouse events like clicks to
// the canvas.
const convertPixelCoordinatesToBarCoordinates = (
  data: FlameGraphDataContainer,
  e: MouseEvent,
  pixelsPerTick: number,
  levels: LevelItem[][],
  totalTicks: number,
  rangeMin: number
) => {
  const levelIndex = Math.floor(e.offsetY / (PIXELS_PER_LEVEL / window.devicePixelRatio));
  const barIndex = getBarIndex(e.offsetX, data, levels[levelIndex], pixelsPerTick, totalTicks, rangeMin);
  return { levelIndex, barIndex };
};

/**
 * Binary search for a bar in a level, based on the X pixel coordinate. Useful for detecting which bar did user click
 * on.
 */
const getBarIndex = (
  x: number,
  data: FlameGraphDataContainer,
  level: LevelItem[],
  pixelsPerTick: number,
  totalTicks: number,
  rangeMin: number
) => {
  if (level) {
    let start = 0;
    let end = level.length - 1;

    while (start <= end) {
      const midIndex = (start + end) >> 1;
      const startOfBar = getBarX(level[midIndex].start, totalTicks, rangeMin, pixelsPerTick);
      const startOfNextBar = getBarX(
        level[midIndex].start + data.getValue(level[midIndex].itemIndex),
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
