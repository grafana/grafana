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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UseMeasureRef } from 'react-use/lib/useMeasure';

import { CoreApp, DataFrame, FieldType, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PIXELS_PER_LEVEL } from '../../constants';
import { TooltipData, SelectedView, FlameGraphScale } from '../types';

import FlameGraphTooltip, { getTooltipData } from './FlameGraphTooltip';
import { ItemWithStart } from './dataTransform';
import { getBarX, getRectDimensionsForLevel, renderRect } from './rendering';

type Props = {
  data: DataFrame;
  app: CoreApp;
  flameGraphHeight?: number;
  levels: ItemWithStart[][];
  topLevelIndex: number;
  rangeMin: number;
  rangeMax: number;
  search: string;
  setTopLevelIndex: (level: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
  flameGraphScale: FlameGraphScale[];
  setScale: (levelIndex: number, barIndex: number) => void;
  selectedView: SelectedView;
  sizeRef: UseMeasureRef<HTMLDivElement>;
  containerWidth: number;
  style?: React.CSSProperties;
};

const FlameGraph = ({
  data,
  app,
  flameGraphHeight,
  levels,
  topLevelIndex,
  rangeMin,
  rangeMax,
  search,
  setTopLevelIndex,
  setRangeMin,
  setRangeMax,
  flameGraphScale,
  setScale,
  selectedView,
  sizeRef,
  containerWidth,
}: Props) => {
  const styles = useStyles2((theme) => getStyles(theme, selectedView, app, flameGraphHeight));
  const totalTicks = data.fields[1].values.get(0);
  const valueField =
    data.fields.find((f) => f.name === 'value') ?? data.fields.find((f) => f.type === FieldType.number);

  const graphRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData>();
  const [showTooltip, setShowTooltip] = useState(false);

  // Convert pixel coordinates to bar coordinates in the levels array so that we can add mouse events like clicks to
  // the canvas.
  const convertPixelCoordinatesToBarCoordinates = useCallback(
    (x: number, y: number, pixelsPerTick: number) => {
      const levelIndex = Math.floor(y / (PIXELS_PER_LEVEL / window.devicePixelRatio));
      const barIndex = getBarIndex(x, levels[levelIndex], pixelsPerTick, totalTicks, rangeMin);
      return { levelIndex, barIndex };
    },
    [levels, totalTicks, rangeMin]
  );

  const render = useCallback(
    (pixelsPerTick: number) => {
      if (!levels.length) {
        return;
      }
      const ctx = graphRef.current?.getContext('2d')!;
      const graph = graphRef.current!;

      const height = PIXELS_PER_LEVEL * levels.length;
      graph.width = Math.round(containerWidth * window.devicePixelRatio);
      graph.height = Math.round(height * window.devicePixelRatio);
      graph.style.width = `${containerWidth}px`;
      graph.style.height = `${height}px`;

      ctx.textBaseline = 'middle';
      ctx.font = 12 * window.devicePixelRatio + 'px monospace';
      ctx.strokeStyle = 'white';

      for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
        const level = levels[levelIndex];
        // Get all the dimensions of the rectangles for the level. We do this by level instead of per rectangle, because
        // sometimes we collapse multiple bars into single rect.
        const dimensions = getRectDimensionsForLevel(level, levelIndex, totalTicks, rangeMin, pixelsPerTick);
        for (const rect of dimensions) {
          // Render each rectangle based on the computed dimensions
          renderRect(ctx, rect, totalTicks, rangeMin, rangeMax, search, levelIndex, topLevelIndex);
        }
      }
    },
    [levels, containerWidth, totalTicks, rangeMin, rangeMax, search, topLevelIndex]
  );

  useEffect(() => {
    setScale(0, 0);
  }, [setScale]);

  useEffect(() => {
    if (graphRef.current) {
      const pixelsPerTick = (containerWidth * window.devicePixelRatio) / totalTicks / (rangeMax - rangeMin);
      render(pixelsPerTick);

      // Clicking allows user to "zoom" into the flamegraph. Zooming means the x axis gets smaller so that the clicked
      // bar takes 100% of the x axis.
      graphRef.current.onclick = (e) => {
        const pixelsPerTick = graphRef.current!.clientWidth / totalTicks / (rangeMax - rangeMin);
        const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(e.offsetX, e.offsetY, pixelsPerTick);

        if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
          setTopLevelIndex(levelIndex);
          setRangeMin(levels[levelIndex][barIndex].start / totalTicks);
          setRangeMax((levels[levelIndex][barIndex].start + levels[levelIndex][barIndex].value) / totalTicks);
          setScale(levelIndex, barIndex);
        }
      };

      graphRef.current!.onmousemove = (e) => {
        if (tooltipRef.current) {
          setShowTooltip(false);
          const pixelsPerTick = graphRef.current!.clientWidth / totalTicks / (rangeMax - rangeMin);
          const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(e.offsetX, e.offsetY, pixelsPerTick);

          if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
            tooltipRef.current.style.left = e.clientX + 10 + 'px';
            tooltipRef.current.style.top = e.clientY + 'px';

            const bar = levels[levelIndex][barIndex];
            const tooltipData = getTooltipData(valueField!, bar.label, bar.value, totalTicks);
            setTooltipData(tooltipData);
            setShowTooltip(true);
          }
        }
      };

      graphRef.current!.onmouseleave = () => {
        setShowTooltip(false);
      };
    }
  }, [
    render,
    convertPixelCoordinatesToBarCoordinates,
    levels,
    rangeMin,
    rangeMax,
    topLevelIndex,
    totalTicks,
    containerWidth,
    setTopLevelIndex,
    setRangeMin,
    setRangeMax,
    selectedView,
    valueField,
    setScale,
    sizeRef,
  ]);

  return (
    <>
      <div className={styles.scaleContainer}>
        {flameGraphScale.map((scaleItem: FlameGraphScale, idx: number) => {
          return (
            <div
              key={idx}
              className={styles.scale}
              style={{ width: `${scaleItem.width}px`, textAlign: idx === 0 ? 'left' : 'right' }}
            >
              <div className={styles.text} style={{ marginLeft: idx === 0 ? '-2px' : '-15px' }}>
                {scaleItem.showText ? scaleItem.text : ''}
              </div>
              <div className={styles.tick}>
                <div>|</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.graph} ref={sizeRef}>
        <canvas ref={graphRef} data-testid="flameGraph" />
        <FlameGraphTooltip tooltipRef={tooltipRef} tooltipData={tooltipData!} showTooltip={showTooltip} />
      </div>
    </>
  );
};

const getStyles = (
  theme: GrafanaTheme2,
  selectedView: SelectedView,
  app: CoreApp,
  flameGraphHeight: number | undefined
) => ({
  graph: css`
    cursor: pointer;
    float: left;
    overflow: scroll;
    width: ${selectedView === SelectedView.FlameGraph ? '100%' : '50%'};
    ${app !== CoreApp.Explore
      ? `height: calc(${flameGraphHeight}px - 94px)`
      : ''}; // to adjust for space needed above flame graph
  `,
  scaleContainer: css`
    height: 30px;
    display: flex;
    margin-bottom: 20px;

    // This keeps the horizontal line inside the first and last ticks.
    & > :nth-child(2) {
      &:before {
        margin-left: 4%;
      }
    }
    & > :nth-child(9) {
      &:before {
        width: 96%;
      }
    }
  `,
  scale: css`
    position: relative;

    &:before {
      content: '';
      position: absolute;
      top: 79%;
      left: 0;
      border-top: 2px solid ${theme.colors.emphasize(theme.colors.text.primary, 0.4)};
      width: 100%;
    }
  `,
  text: css`
    color: ${theme.colors.emphasize(theme.colors.text.primary, 0.25)};
    display: inline-block;
    position: absolute;
    white-space: nowrap;
  `,
  tick: css`
    color: ${theme.colors.emphasize(theme.colors.text.primary, 0.1)};
    margin: 13px 0 0 0;
  `,
});

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
