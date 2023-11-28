import { __awaiter } from "tslib";
import { ResourceDimensionMode } from '@grafana/schema';
import { HorizontalAlign, VerticalAlign } from './types';
import { getDisplacement, getStyleConfigState } from './utils';
describe('style utils', () => {
    it('should fill in default values', () => __awaiter(void 0, void 0, void 0, function* () {
        const cfg = {
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
        const state = yield getStyleConfigState(cfg);
        state.config = null; // not interesting in the snapshot
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
    }));
    it('should return correct displacement array for top left', () => __awaiter(void 0, void 0, void 0, function* () {
        const symbolAlign = { horizontal: HorizontalAlign.Left, vertical: VerticalAlign.Top };
        const radius = 10;
        const displacement = getDisplacement(symbolAlign, radius);
        expect(displacement).toEqual([-10, 10]);
    }));
    it('should return correct displacement array for bottom right', () => __awaiter(void 0, void 0, void 0, function* () {
        const symbolAlign = { horizontal: HorizontalAlign.Right, vertical: VerticalAlign.Bottom };
        const radius = 10;
        const displacement = getDisplacement(symbolAlign, radius);
        expect(displacement).toEqual([10, -10]);
    }));
    it('should return correct displacement array for center center', () => __awaiter(void 0, void 0, void 0, function* () {
        const symbolAlign = { horizontal: HorizontalAlign.Center, vertical: VerticalAlign.Center };
        const radius = 10;
        const displacement = getDisplacement(symbolAlign, radius);
        expect(displacement).toEqual([0, 0]);
    }));
});
//# sourceMappingURL=utils.test.js.map