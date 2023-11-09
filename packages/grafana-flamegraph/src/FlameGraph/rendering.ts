import uFuzzy from '@leeoniya/ufuzzy';
import { RefObject, useEffect, useMemo, useState } from 'react';
import color from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import {
  BAR_BORDER_WIDTH,
  BAR_TEXT_PADDING_LEFT,
  COLLAPSE_THRESHOLD,
  HIDE_THRESHOLD,
  LABEL_THRESHOLD,
  PIXELS_PER_LEVEL,
} from '../constants';
import { ClickedItemData, ColorScheme, ColorSchemeDiff, TextAlign } from '../types';

import { getBarColorByDiff, getBarColorByPackage, getBarColorByValue } from './colors';
import { FlameGraphDataContainer, LevelItem } from './dataTransform';

const ufuzzy = new uFuzzy();

type RenderOptions = {
  canvasRef: RefObject<HTMLCanvasElement>;
  data: FlameGraphDataContainer;
  root: LevelItem;
  direction: 'children' | 'parents';

  // Depth in number of levels
  depth: number;
  wrapperWidth: number;

  // If we are rendering only zoomed in part of the graph.
  rangeMin: number;
  rangeMax: number;

  search: string;
  textAlign: TextAlign;

  // Total ticks that will be used for sizing
  totalViewTicks: number;
  // Total ticks that will be used for computing colors as some color scheme (like in diff view) should not be affected
  // by sandwich or focus view.
  totalColorTicks: number;
  // Total ticks used to compute the diff colors
  totalTicksRight: number | undefined;
  colorScheme: ColorScheme | ColorSchemeDiff;
  focusedItemData?: ClickedItemData;
};

export function useFlameRender(options: RenderOptions) {
  const {
    canvasRef,
    data,
    root,
    depth,
    direction,
    wrapperWidth,
    rangeMin,
    rangeMax,
    search,
    textAlign,
    totalViewTicks,
    totalColorTicks,
    totalTicksRight,
    colorScheme,
    focusedItemData,
  } = options;
  const foundLabels = useFoundLabels(search, data);
  const ctx = useSetupCanvas(canvasRef, wrapperWidth, depth);
  const theme = useTheme2();

  // There is a bit of dependency injections here that does not add readability, mainly to prevent recomputing some
  // common stuff for all the nodes in the graph when only once is enough. perf/readability tradeoff.

  const getBarColor = useColorFunction(
    totalColorTicks,
    totalTicksRight,
    colorScheme,
    theme,
    rangeMin,
    rangeMax,
    foundLabels,
    focusedItemData ? focusedItemData.item.level : 0
  );
  const renderFunc = useRenderFunc(ctx, data, getBarColor, textAlign);

  useEffect(() => {
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    walkTree(root, direction, data, totalViewTicks, rangeMin, rangeMax, wrapperWidth, renderFunc);
  }, [ctx, data, root, wrapperWidth, rangeMin, rangeMax, totalViewTicks, direction, renderFunc]);
}

type RenderFunc = (
  item: LevelItem,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  // Collapsed means the width is too small to show the label, and we group collapsed siblings together.
  collapsed: boolean
) => void;

function useRenderFunc(
  ctx: CanvasRenderingContext2D | undefined,
  data: FlameGraphDataContainer,
  getBarColor: (item: LevelItem, label: string, collapsed: boolean) => string,
  textAlign: TextAlign
): RenderFunc {
  return useMemo(() => {
    if (!ctx) {
      return () => {};
    }

    return (item, x, y, width, height, label, collapsed) => {
      ctx.beginPath();
      ctx.rect(x + (collapsed ? 0 : BAR_BORDER_WIDTH), y, width, height);
      ctx.fillStyle = getBarColor(item, label, collapsed);

      if (collapsed) {
        // Only fill the collapsed rects
        ctx.fill();
      } else {
        ctx.stroke();
        ctx.fill();

        if (width >= LABEL_THRESHOLD) {
          renderLabel(ctx, data, label, item, width, x, y, textAlign);
        }
      }
    };
  }, [ctx, getBarColor, textAlign, data]);
}

/**
 * Exported for testing don't use directly
 * Walks the tree and computes coordinates, dimensions and other data needed for rendering. For each item in the tree
 * it defers the rendering to the renderFunc.
 */
export function walkTree(
  root: LevelItem,
  // In sandwich view we use parents direction to show all callers.
  direction: 'children' | 'parents',
  data: FlameGraphDataContainer,
  totalViewTicks: number,
  rangeMin: number,
  rangeMax: number,
  wrapperWidth: number,
  renderFunc: RenderFunc
) {
  const stack: LevelItem[] = [];
  stack.push(root);

  const pixelsPerTick = (wrapperWidth * window.devicePixelRatio) / totalViewTicks / (rangeMax - rangeMin);

  while (stack.length > 0) {
    const item = stack.shift()!;
    let curBarTicks = item.value;
    // Multiple collapsed items are shown as a single gray bar
    const collapsed = curBarTicks * pixelsPerTick <= COLLAPSE_THRESHOLD;
    const width = curBarTicks * pixelsPerTick - (collapsed ? 0 : BAR_BORDER_WIDTH * 2);
    const height = PIXELS_PER_LEVEL;

    if (width < HIDE_THRESHOLD) {
      // We don't render nor it's children
      continue;
    }

    const barX = getBarX(item.start, totalViewTicks, rangeMin, pixelsPerTick);
    const barY = item.level * PIXELS_PER_LEVEL;

    let label = data.getLabel(item.itemIndexes[0]);

    renderFunc(item, barX, barY, width, height, label, collapsed);

    const nextList = direction === 'children' ? item.children : item.parents;
    if (nextList) {
      stack.unshift(...nextList);
    }
  }
}

/**
 * Based on the search string it does a fuzzy search over all the unique labels so we can highlight them later.
 */
function useFoundLabels(search: string | undefined, data: FlameGraphDataContainer): Set<string> | undefined {
  return useMemo(() => {
    if (search) {
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

function useColorFunction(
  totalTicks: number,
  totalTicksRight: number | undefined,
  colorScheme: ColorScheme | ColorSchemeDiff,
  theme: GrafanaTheme2,
  rangeMin: number,
  rangeMax: number,
  foundNames: Set<string> | undefined,
  topLevel: number
) {
  return useMemo(() => {
    // We use the same color for all muted bars so let's do it just once and reuse the result in the closure of the
    // returned function.
    const barMutedColor = color(theme.colors.background.secondary);
    const barMutedColorHex = theme.isLight
      ? barMutedColor.darken(10).toHexString()
      : barMutedColor.lighten(10).toHexString();

    return function getColor(item: LevelItem, label: string, collapsed: boolean) {
      // If collapsed and no search we can quickly return the muted color
      if (collapsed && !foundNames) {
        // Collapsed are always grayed
        return barMutedColorHex;
      }

      const barColor =
        item.valueRight !== undefined &&
        (colorScheme === ColorSchemeDiff.Default || colorScheme === ColorSchemeDiff.DiffColorBlind)
          ? getBarColorByDiff(item.value, item.valueRight!, totalTicks, totalTicksRight!, colorScheme)
          : colorScheme === ColorScheme.ValueBased
          ? getBarColorByValue(item.value, totalTicks, rangeMin, rangeMax)
          : getBarColorByPackage(label, theme);

      if (foundNames) {
        // Means we are searching, we use color for matches and gray the rest
        return foundNames.has(label) ? barColor.toHslString() : barMutedColorHex;
      }

      // Mute if we are above the focused symbol
      return item.level > topLevel - 1 ? barColor.toHslString() : barColor.lighten(15).toHslString();
    };
  }, [totalTicks, totalTicksRight, colorScheme, theme, rangeMin, rangeMax, foundNames, topLevel]);
}

function useSetupCanvas(canvasRef: RefObject<HTMLCanvasElement>, wrapperWidth: number, numberOfLevels: number) {
  const [ctx, setCtx] = useState<CanvasRenderingContext2D>();

  useEffect(() => {
    if (!(numberOfLevels && canvasRef.current)) {
      return;
    }
    const ctx = canvasRef.current.getContext('2d')!;

    const height = PIXELS_PER_LEVEL * numberOfLevels;
    canvasRef.current.width = Math.round(wrapperWidth * window.devicePixelRatio);
    canvasRef.current.height = Math.round(height);
    canvasRef.current.style.width = `${wrapperWidth}px`;
    canvasRef.current.style.height = `${height / window.devicePixelRatio}px`;

    ctx.textBaseline = 'middle';
    ctx.font = 12 * window.devicePixelRatio + 'px monospace';
    ctx.strokeStyle = 'white';
    setCtx(ctx);
  }, [canvasRef, setCtx, wrapperWidth, numberOfLevels]);
  return ctx;
}

// Renders a text inside the node rectangle. It allows setting alignment of the text left or right which takes effect
// when text is too long to fit in the rectangle.
function renderLabel(
  ctx: CanvasRenderingContext2D,
  data: FlameGraphDataContainer,
  label: string,
  item: LevelItem,
  width: number,
  x: number,
  y: number,
  textAlign: TextAlign
) {
  ctx.save();
  ctx.clip(); // so text does not overflow
  ctx.fillStyle = '#222';

  const displayValue = data.valueDisplayProcessor(item.value);
  const unit = displayValue.suffix ? displayValue.text + displayValue.suffix : displayValue.text;

  // We only measure name here instead of full label because of how we deal with the units and aligning later.
  const measure = ctx.measureText(label);
  const spaceForTextInRect = width - BAR_TEXT_PADDING_LEFT;

  let fullLabel = `${label} (${unit})`;
  let labelX = Math.max(x, 0) + BAR_TEXT_PADDING_LEFT;

  // We use the desired alignment only if there is not enough space for the text, otherwise we keep left alignment as
  // that will already show full text.
  if (measure.width > spaceForTextInRect) {
    ctx.textAlign = textAlign;
    // If aligned to the right we don't want to take the space with the unit label as the assumption is user wants to
    // mainly see the name. This also reflects how pyro/flamegraph works.
    if (textAlign === 'right') {
      fullLabel = label;
      labelX = x + width - BAR_TEXT_PADDING_LEFT;
    }
  }

  ctx.fillText(fullLabel, labelX, y + PIXELS_PER_LEVEL / 2);
  ctx.restore();
}

/**
 * Returns the X position of the bar. totalTicks * rangeMin is to adjust for any current zoom. So if we zoom to a
 * section of the graph we align and shift the X coordinates accordingly.
 * @param offset
 * @param totalTicks
 * @param rangeMin
 * @param pixelsPerTick
 */
export function getBarX(offset: number, totalTicks: number, rangeMin: number, pixelsPerTick: number) {
  return (offset - totalTicks * rangeMin) * pixelsPerTick;
}
