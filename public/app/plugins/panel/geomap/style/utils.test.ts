import { ResourceDimensionMode } from '@grafana/schema';

import { HorizontalAlign, VerticalAlign, StyleConfig, SymbolAlign } from './types';
import { getDisplacement, getRGBValues, getStyleConfigState } from './utils';

describe('style utils', () => {
  it('should fill in default values', async () => {
    const cfg: StyleConfig = {
      color: {
        field: 'Price',
        fixed: 'dark-green',
      },
      opacity: 0.4,
      size: {
        field: 'Count',
        fixed: 5,
        max: 15,
        min: 2,
      },
      symbol: {
        fixed: 'img/icons/marker/star.svg',
        mode: ResourceDimensionMode.Fixed, // 'fixed',
      },
      textConfig: {
        fontSize: 12,
        offsetX: 0,
        offsetY: 0,
        // textAlign: 'center',
        // textBaseline: 'middle',
      },
    };

    const state = await getStyleConfigState(cfg);
    state.config = null as unknown as StyleConfig; // not interesting in the snapshot
    expect(state.hasText).toBe(false);
    expect(state).toMatchInlineSnapshot(`
      {
        "base": {
          "color": "#37872D",
          "lineWidth": 1,
          "opacity": 0.4,
          "rotation": 0,
          "size": 5,
          "symbolAlign": {
            "horizontal": "center",
            "vertical": "center",
          },
        },
        "config": null,
        "fields": {
          "color": "Price",
          "size": "Count",
        },
        "hasText": false,
        "maker": [Function],
      }
    `);
  });
  it('should return correct displacement array for top left', async () => {
    const symbolAlign: SymbolAlign = { horizontal: HorizontalAlign.Left, vertical: VerticalAlign.Top };
    const radius = 10;
    const displacement = getDisplacement(symbolAlign, radius);
    expect(displacement).toEqual([-10, 10]);
  });
  it('should return correct displacement array for bottom right', async () => {
    const symbolAlign: SymbolAlign = { horizontal: HorizontalAlign.Right, vertical: VerticalAlign.Bottom };
    const radius = 10;
    const displacement = getDisplacement(symbolAlign, radius);
    expect(displacement).toEqual([10, -10]);
  });
  it('should return correct displacement array for center center', async () => {
    const symbolAlign: SymbolAlign = { horizontal: HorizontalAlign.Center, vertical: VerticalAlign.Center };
    const radius = 10;
    const displacement = getDisplacement(symbolAlign, radius);
    expect(displacement).toEqual([0, 0]);
  });
  it('should return correct color values for hex default color', async () => {
    const colorString = '#37872d';
    const colorValues = getRGBValues(colorString);
    expect(colorValues).toEqual({ r: 55, g: 135, b: 45 });
  });
  it('should return correct color values for rgb color', async () => {
    const colorString = 'rgb(242, 73, 92)';
    const colorValues = getRGBValues(colorString);
    expect(colorValues).toEqual({ r: 242, g: 73, b: 92 });
  });
  it('should return correct color values for rgba color', async () => {
    const colorString = 'rgba(90, 0, 135, 0.5)';
    const colorValues = getRGBValues(colorString);
    expect(colorValues).toEqual({ r: 90, g: 0, b: 135, a: 0.5 });
  });
  it('should return correct color values for transparent color', async () => {
    const colorString = 'rgba(0, 0, 0, 0)';
    const colorValues = getRGBValues(colorString);
    expect(colorValues).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});
