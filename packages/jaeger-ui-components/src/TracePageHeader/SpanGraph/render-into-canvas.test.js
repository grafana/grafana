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

import _range from 'lodash/range';

import renderIntoCanvas, {
  BG_COLOR,
  ITEM_ALPHA,
  MIN_ITEM_HEIGHT,
  MAX_TOTAL_HEIGHT,
  MIN_ITEM_WIDTH,
  MIN_TOTAL_HEIGHT,
  MAX_ITEM_HEIGHT,
} from './render-into-canvas';

const getCanvasWidth = () => window.innerWidth * 2;
const getBgFillRect = items => ({
  fillStyle: BG_COLOR,
  height: !items || items.length < MIN_TOTAL_HEIGHT ? MIN_TOTAL_HEIGHT : Math.min(MAX_TOTAL_HEIGHT, items.length),
  width: getCanvasWidth(),
  x: 0,
  y: 0,
});

describe('renderIntoCanvas()', () => {
  const basicItem = { valueWidth: 100, valueOffset: 50, serviceName: 'some-name' };

  class CanvasContext {
    constructor() {
      this.fillStyle = undefined;
      this.fillRectAccumulator = [];
    }

    fillRect(x, y, width, height) {
      const fillStyle = this.fillStyle;
      this.fillRectAccumulator.push({
        fillStyle,
        height,
        width,
        x,
        y,
      });
    }
  }

  class Canvas {
    constructor() {
      this.contexts = [];
      this.height = NaN;
      this.width = NaN;
      this.getContext = jest.fn(this._getContext.bind(this));
    }

    _getContext() {
      const ctx = new CanvasContext();
      this.contexts.push(ctx);
      return ctx;
    }
  }

  function getColorFactory() {
    let i = 0;
    const inputOutput = [];
    function getFakeColor(str) {
      const rv = [i, i, i];
      i++;
      inputOutput.push({
        input: str,
        output: rv.slice(),
      });
      return rv;
    }
    getFakeColor.inputOutput = inputOutput;
    return getFakeColor;
  }

  it('sets the width', () => {
    const canvas = new Canvas();
    expect(canvas.width !== canvas.width).toBe(true);
    renderIntoCanvas(canvas, [basicItem], 150, getColorFactory());
    expect(canvas.width).toBe(getCanvasWidth());
  });

  describe('when there are limited number of items', () => {
    it('sets the height', () => {
      const canvas = new Canvas();
      expect(canvas.height !== canvas.height).toBe(true);
      renderIntoCanvas(canvas, [basicItem], 150, getColorFactory());
      expect(canvas.height).toBe(MIN_TOTAL_HEIGHT);
    });

    it('draws the background', () => {
      const expectedDrawing = [getBgFillRect()];
      const canvas = new Canvas();
      const items = [];
      const totalValueWidth = 4000;
      const getFillColor = getColorFactory();
      renderIntoCanvas(canvas, items, totalValueWidth, getFillColor);
      expect(canvas.getContext.mock.calls).toEqual([['2d', { alpha: false }]]);
      expect(canvas.contexts.length).toBe(1);
      expect(canvas.contexts[0].fillRectAccumulator).toEqual(expectedDrawing);
    });

    it('draws the map', () => {
      const totalValueWidth = 4000;
      const items = [
        { valueWidth: 50, valueOffset: 50, serviceName: 'service-name-0' },
        { valueWidth: 100, valueOffset: 100, serviceName: 'service-name-1' },
        { valueWidth: 150, valueOffset: 150, serviceName: 'service-name-2' },
      ];
      const expectedColors = [
        { input: items[0].serviceName, output: [0, 0, 0] },
        { input: items[1].serviceName, output: [1, 1, 1] },
        { input: items[2].serviceName, output: [2, 2, 2] },
      ];
      const cHeight = items.length < MIN_TOTAL_HEIGHT ? MIN_TOTAL_HEIGHT : Math.min(items.length, MAX_TOTAL_HEIGHT);

      const expectedDrawings = [
        getBgFillRect(),
        ...items.map((item, i) => {
          const { valueWidth, valueOffset } = item;
          const color = expectedColors[i].output;
          const fillStyle = `rgba(${color.concat(ITEM_ALPHA).join()})`;
          const height = Math.min(MAX_ITEM_HEIGHT, Math.max(MIN_ITEM_HEIGHT, cHeight / items.length));
          const width = (valueWidth / totalValueWidth) * getCanvasWidth();
          const x = (valueOffset / totalValueWidth) * getCanvasWidth();
          const y = (cHeight / items.length) * i;
          return { fillStyle, height, width, x, y };
        }),
      ];
      const canvas = new Canvas();
      const getFillColor = getColorFactory();
      renderIntoCanvas(canvas, items, totalValueWidth, getFillColor);
      expect(getFillColor.inputOutput).toEqual(expectedColors);
      expect(canvas.getContext.mock.calls).toEqual([['2d', { alpha: false }]]);
      expect(canvas.contexts.length).toBe(1);
      expect(canvas.contexts[0].fillRectAccumulator).toEqual(expectedDrawings);
    });
  });

  describe('when there are many items', () => {
    it('sets the height when there are many items', () => {
      const canvas = new Canvas();
      const items = [];
      for (let i = 0; i < MIN_TOTAL_HEIGHT + 1; i++) {
        items.push(basicItem);
      }
      expect(canvas.height !== canvas.height).toBe(true);
      renderIntoCanvas(canvas, items, 150, getColorFactory());
      expect(canvas.height).toBe(items.length);
    });

    it('draws the map', () => {
      const totalValueWidth = 4000;
      const items = _range(MIN_TOTAL_HEIGHT * 10).map(i => ({
        valueWidth: i,
        valueOffset: i,
        serviceName: `service-name-${i}`,
      }));
      const expectedColors = items.map((item, i) => ({
        input: item.serviceName,
        output: [i, i, i],
      }));
      const expectedDrawings = [
        getBgFillRect(items),
        ...items.map((item, i) => {
          const { valueWidth, valueOffset } = item;
          const color = expectedColors[i].output;
          const fillStyle = `rgba(${color.concat(ITEM_ALPHA).join()})`;
          const height = MIN_ITEM_HEIGHT;
          const width = Math.max(MIN_ITEM_WIDTH, (valueWidth / totalValueWidth) * getCanvasWidth());
          const x = (valueOffset / totalValueWidth) * getCanvasWidth();
          const y = (MAX_TOTAL_HEIGHT / items.length) * i;
          return { fillStyle, height, width, x, y };
        }),
      ];
      const canvas = new Canvas();
      const getFillColor = getColorFactory();
      renderIntoCanvas(canvas, items, totalValueWidth, getFillColor);
      expect(getFillColor.inputOutput).toEqual(expectedColors);
      expect(canvas.getContext.mock.calls).toEqual([['2d', { alpha: false }]]);
      expect(canvas.contexts.length).toBe(1);
      expect(canvas.contexts[0].fillRectAccumulator).toEqual(expectedDrawings);
    });
  });
});
