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

import { CoreApp, createTheme, DataFrame, FieldType, getDisplayProcessor } from '@grafana/data';

import { PIXELS_PER_LEVEL } from '../../constants';
import { TooltipData, SelectedView, ContextMenuData } from '../types';

import FlameGraphContextMenu from './FlameGraphContextMenu';
import FlameGraphMetadata from './FlameGraphMetadata';
import FlameGraphTooltip, { getTooltipData } from './FlameGraphTooltip';
import { ItemWithStart } from './dataTransform';
import { getBarX, getRectDimensionsForLevel, renderRect } from './rendering';

type Props = {
  data: DataFrame;
  app: CoreApp;
  flameGraphHeight?: number;
  levels: ItemWithStart[][];
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
  getLabelValue: (label: string | number) => string;
};

const FlameGraph = ({
  data,
  app,
  flameGraphHeight,
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
  getLabelValue,
}: Props) => {
  const styles = getStyles(selectedView, app, flameGraphHeight);
  const totalTicks = data.fields[1].values.get(0);
  const valueField =
    data.fields.find((f) => f.name === 'value') ?? data.fields.find((f) => f.type === FieldType.number);

  if (!valueField) {
    throw new Error('Malformed dataFrame: value field of type number is not in the query response');
  }

  const [sizeRef, { width: wrapperWidth }] = useMeasure<HTMLDivElement>();
  const graphRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData>();
  const [contextMenuData, setContextMenuData] = useState<ContextMenuData>();

  const [ufuzzy] = useState(() => {
    return new uFuzzy();
  });

  const uniqueLabels = useMemo(() => {
    const labelField = data.fields.find((f) => f.name === 'label');
    const enumConfig = labelField?.config?.type?.enum;
    if (enumConfig) {
      return enumConfig.text || [];
    } else {
      return [...new Set<string>(labelField?.values.toArray())];
    }
  }, [data]);

  const foundLabels = useMemo(() => {
    const foundLabels = new Set<string>();

    if (search) {
      let idxs = ufuzzy.filter(uniqueLabels, search);

      if (idxs) {
        for (let idx of idxs) {
          foundLabels.add(uniqueLabels[idx]);
        }
      }
    }

    return foundLabels;
  }, [ufuzzy, search, uniqueLabels]);

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

    const processor = getDisplayProcessor({
      field: valueField,
      theme: createTheme() /* theme does not matter for us here */,
    });

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
      const level = levels[levelIndex];
      // Get all the dimensions of the rectangles for the level. We do this by level instead of per rectangle, because
      // sometimes we collapse multiple bars into single rect.
      const dimensions = getRectDimensionsForLevel(
        level,
        levelIndex,
        totalTicks,
        rangeMin,
        pixelsPerTick,
        processor,
        getLabelValue
      );
      for (const rect of dimensions) {
        // Render each rectangle based on the computed dimensions
        renderRect(ctx, rect, totalTicks, rangeMin, rangeMax, search, levelIndex, topLevelIndex, foundLabels);
      }
    }
  }, [
    levels,
    wrapperWidth,
    valueField,
    totalTicks,
    rangeMin,
    rangeMax,
    search,
    topLevelIndex,
    foundLabels,
    getLabelValue,
  ]);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.onclick = (e) => {
        setTooltipData(undefined);
        const pixelsPerTick = graphRef.current!.clientWidth / totalTicks / (rangeMax - rangeMin);
        const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(
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
          setTooltipData(undefined);
          const pixelsPerTick = graphRef.current!.clientWidth / totalTicks / (rangeMax - rangeMin);
          const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(
            e,
            pixelsPerTick,
            levels,
            totalTicks,
            rangeMin
          );

          if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
            tooltipRef.current.style.left = e.clientX + 10 + 'px';
            tooltipRef.current.style.top = e.clientY + 'px';

            const bar = levels[levelIndex][barIndex];
            const tooltipData = getTooltipData(valueField, bar.label, bar.value, bar.self, totalTicks);
            setTooltipData(tooltipData);
          }
        }
      };

      graphRef.current!.onmouseleave = () => {
        setTooltipData(undefined);
      };
    }
  }, [
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
    valueField,
    setSelectedBarIndex,
    setContextMenuData,
    contextMenuData,
  ]);

  // hide context menu if outside of the flame graph canvas is clicked
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
        levels={levels}
        topLevelIndex={topLevelIndex}
        selectedBarIndex={selectedBarIndex}
        valueField={valueField}
        totalTicks={totalTicks}
      />
      <div className={styles.canvasContainer} id="flameGraphCanvasContainer">
        <canvas ref={graphRef} data-testid="flameGraph" />
      </div>
      <FlameGraphTooltip tooltipRef={tooltipRef} tooltipData={tooltipData!} getLabelValue={getLabelValue} />
      {contextMenuData && (
        <FlameGraphContextMenu
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

const getStyles = (selectedView: SelectedView, app: CoreApp, flameGraphHeight: number | undefined) => ({
  graph: css`
    float: left;
    overflow: scroll;
    width: ${selectedView === SelectedView.FlameGraph ? '100%' : '50%'};
    ${app !== CoreApp.Explore
      ? `height: calc(${flameGraphHeight}px - 50px)`
      : ''}; // 50px to adjust for header pushing content down
  `,
  canvasContainer: css`
    cursor: pointer;
  `,
});

// Convert pixel coordinates to bar coordinates in the levels array so that we can add mouse events like clicks to
// the canvas.
const convertPixelCoordinatesToBarCoordinates = (
  e: MouseEvent,
  pixelsPerTick: number,
  levels: ItemWithStart[][],
  totalTicks: number,
  rangeMin: number
) => {
  const levelIndex = Math.floor(e.offsetY / (PIXELS_PER_LEVEL / window.devicePixelRatio));
  const barIndex = getBarIndex(e.offsetX, levels[levelIndex], pixelsPerTick, totalTicks, rangeMin);
  return { levelIndex, barIndex };
};

/**
 * Binary search for a bar in a level, based on the X pixel coordinate. Useful for detecting which bar did user click
 * on.
 */
const getBarIndex = (
  x: number,
  level: ItemWithStart[],
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
