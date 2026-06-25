// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// exported for tests
export const ITEM_ALPHA = 0.8;
export const MIN_ITEM_HEIGHT = 2;
export const MAX_TOTAL_HEIGHT = 200;
export const MIN_ITEM_WIDTH = 10;
export const MIN_TOTAL_HEIGHT = 60;
export const MAX_ITEM_HEIGHT = 6;

type SpanGraphItem = {
  valueWidth: number;
  valueOffset: number;
  serviceName: string;
  isSummary?: boolean;
  spanCount?: number;
};

// Light-to-dark gradient within the service hue, matching the waterfall summary
// bar (which uses CSS color-mix; canvas has no color-mix so we mix in JS).
const TINT = 0.3; // toward white at the left
const SHADE = 0.55; // toward black at the right
const rgba = ([r, g, b]: [number, number, number]) => `rgba(${r},${g},${b},${ITEM_ALPHA})`;
const tint = ([r, g, b]: [number, number, number]) =>
  rgba([r + (255 - r) * TINT, g + (255 - g) * TINT, b + (255 - b) * TINT]);
const shade = ([r, g, b]: [number, number, number]) => rgba([r * (1 - SHADE), g * (1 - SHADE), b * (1 - SHADE)]);

export default function renderIntoCanvas(
  canvas: HTMLCanvasElement,
  items: SpanGraphItem[],
  totalValueWidth: number,
  getFillColor: (serviceName: string) => [number, number, number],
  bgColor: string
) {
  const colorCache: Map<string, [number, number, number]> = new Map();
  // A summary span weighs as much as the spans it represents (span_count), so the
  // pruned trace keeps the unpruned density shape: total weight equals the original
  // span count, and the summary occupies the vertical extent its spans would have.
  // Fixed weight would only signal "a summary is here" and flatten that shape, which
  // is what #1031's "shape preservation" mockup explicitly restores. A normal span
  // weighs 1; a summary with no span_count falls back to 1.
  const weightOf = (item: SpanGraphItem) => (item.isSummary ? Math.max(item.spanCount ?? 0, 1) : 1);
  const totalWeight = items.reduce((sum, item) => sum + weightOf(item), 0);
  const cHeight = totalWeight < MIN_TOTAL_HEIGHT ? MIN_TOTAL_HEIGHT : Math.min(totalWeight, MAX_TOTAL_HEIGHT);
  const cWidth = window.innerWidth * 2;
  // eslint-disable-next-line no-param-reassign
  canvas.width = cWidth;
  // eslint-disable-next-line no-param-reassign
  canvas.height = cHeight;
  // Pixels per unit of weight. With no summary spans, weight === index and this
  // matches the previous layout exactly.
  const step = cHeight / totalWeight;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cWidth, cHeight);
    let cumulativeWeight = 0;
    for (let i = 0; i < items.length; i++) {
      const { valueWidth, valueOffset, serviceName, isSummary } = items[i];
      const x = (valueOffset / totalValueWidth) * cWidth;
      let width = (valueWidth / totalValueWidth) * cWidth;
      if (width < MIN_ITEM_WIDTH) {
        width = MIN_ITEM_WIDTH;
      }
      const weight = weightOf(items[i]);
      // Summary fills its whole proportional slot (the vertical extent its spans
      // would have occupied); normal spans keep the clamped thin-bar height.
      const itemHeight = isSummary
        ? Math.max(MIN_ITEM_HEIGHT, step * weight)
        : Math.min(MAX_ITEM_HEIGHT, Math.max(MIN_ITEM_HEIGHT, step * weight));
      const y = step * cumulativeWeight;

      let rgb = colorCache.get(serviceName);
      if (!rgb) {
        rgb = getFillColor(serviceName);
        colorCache.set(serviceName, rgb);
      }
      if (isSummary) {
        const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
        gradient.addColorStop(0, tint(rgb));
        gradient.addColorStop(0.38, rgba(rgb));
        gradient.addColorStop(1, shade(rgb));
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = rgba(rgb);
      }
      ctx.fillRect(x, y, width, itemHeight);
      cumulativeWeight += weight;
    }
  }
}
