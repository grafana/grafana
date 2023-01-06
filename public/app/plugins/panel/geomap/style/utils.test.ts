import { ResourceDimensionMode } from 'app/features/dimensions';

import { StyleConfig } from './types';
import { getStyleConfigState } from './utils';

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
});
