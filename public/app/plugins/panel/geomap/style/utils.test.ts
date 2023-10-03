import { ResourceDimensionMode } from '@grafana/schema';

import { AnchorX, AnchorY, StyleConfig, SymbolAnchor } from './types';
import { getDisplacement, getStyleConfigState } from './utils';

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
          "symbolAnchor": {
            "anchorX": "center",
            "anchorY": "center",
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
    const symbolAnchor: SymbolAnchor = { anchorX: AnchorX.Left, anchorY: AnchorY.Top };
    const radius = 10;
    const displacement = getDisplacement(symbolAnchor, radius);
    expect(displacement).toEqual([10, -10]);
  });
  it('should return correct displacement array for bottom right', async () => {
    const symbolAnchor: SymbolAnchor = { anchorX: AnchorX.Right, anchorY: AnchorY.Bottom };
    const radius = 10;
    const displacement = getDisplacement(symbolAnchor, radius);
    expect(displacement).toEqual([-10, 10]);
  });
  it('should return correct displacement array for center center', async () => {
    const symbolAnchor: SymbolAnchor = { anchorX: AnchorX.Center, anchorY: AnchorY.Center };
    const radius = 10;
    const displacement = getDisplacement(symbolAnchor, radius);
    expect(displacement).toEqual([0, 0]);
  });
});
