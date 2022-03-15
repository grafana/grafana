import { DeepReadonly } from 'ts-essentials';
import { Maybe } from 'true-myth';
import { createFF } from '../flamebearer';
import { Flamebearer } from './models/flamebearer';
import { PX_PER_LEVEL, BAR_HEIGHT, COLLAPSE_THRESHOLD } from './constants';
import type { FlamegraphPalette } from './colorPalette';
import RenderCanvas from './Flamegraph_render';

type XYWithinBounds = { x: number; y: number } & { __brand: 'XYWithinBounds' };

export default class Flamegraph {
  private ff: ReturnType<typeof createFF>;

  constructor(
    private readonly flamebearer: Flamebearer,
    private canvas: HTMLCanvasElement,
    /**
     * What node to be 'focused'
     * ie what node to start the tree
     */
    private focusedNode: Maybe<DeepReadonly<{ i: number; j: number }>>,
    /**
     * What level has been "selected"
     * All nodes above will be dimmed out
     */
    //    private selectedLevel: number,
    private readonly fitMode: 'HEAD' | 'TAIL',
    /**
     * The query used to match against the node name.
     * For each node,
     * if it matches it will be highlighted,
     * otherwise it will be greyish.
     */
    private readonly highlightQuery: string,
    private zoom: Maybe<DeepReadonly<{ i: number; j: number }>>,

    private palette: FlamegraphPalette
  ) {
    // TODO
    // these were only added because storybook is not setting
    // the property to the component
    this.zoom = zoom;
    this.focusedNode = focusedNode;
    this.flamebearer = flamebearer;
    this.canvas = canvas;
    this.highlightQuery = highlightQuery;
    this.ff = createFF(flamebearer.format);
    this.palette = palette;

    // don't allow to have a zoom smaller than the focus
    // since it does not make sense
    if (focusedNode.isJust && zoom.isJust) {
      if (zoom.value.i < focusedNode.value.i) {
        throw new Error('Zoom i level should be bigger than Focus');
      }
    }
  }

  render() {
    const { rangeMin, rangeMax } = this.getRange();

    const props = {
      canvas: this.canvas,

      format: this.flamebearer.format,
      numTicks: this.flamebearer.numTicks,
      sampleRate: this.flamebearer.sampleRate,
      names: this.flamebearer.names,
      levels: this.flamebearer.levels,
      spyName: this.flamebearer.spyName,
      units: this.flamebearer.units,

      rangeMin,
      rangeMax,
      fitMode: this.fitMode,
      highlightQuery: this.highlightQuery,
      zoom: this.zoom,
      focusedNode: this.focusedNode,
      pxPerTick: this.pxPerTick(),
      tickToX: this.tickToX,
      palette: this.palette,
    };

    const { format: viewType } = this.flamebearer;

    switch (viewType) {
      case 'single': {
        RenderCanvas({ ...props, format: 'single' });
        break;
      }
      case 'double': {
        RenderCanvas({
          ...props,
          leftTicks: this.flamebearer.leftTicks,
          rightTicks: this.flamebearer.rightTicks,
        });
        break;
      }
      default: {
        throw new Error(`Invalid format: '${viewType}'`);
      }
    }
  }

  private pxPerTick() {
    const { rangeMin, rangeMax } = this.getRange();
    //    const graphWidth = this.canvas.width;
    const graphWidth = this.getCanvasWidth();

    return graphWidth / this.flamebearer.numTicks / (rangeMax - rangeMin);
  }

  private tickToX = (i: number) => {
    const { rangeMin } = this.getRange();
    return (i - this.flamebearer.numTicks * rangeMin) * this.pxPerTick();
  };

  private getRange() {
    const { ff } = this;

    // delay calculation since they may not be set
    const calculatedZoomRange = (zoom: { i: number; j: number }) => {
      const zoomMin = ff.getBarOffset(this.flamebearer.levels[zoom.i], zoom.j) / this.flamebearer.numTicks;
      const zoomMax =
        (ff.getBarOffset(this.flamebearer.levels[zoom.i], zoom.j) +
          ff.getBarTotal(this.flamebearer.levels[zoom.i], zoom.j)) /
        this.flamebearer.numTicks;

      return {
        rangeMin: zoomMin,
        rangeMax: zoomMax,
      };
    };

    const calculatedFocusRange = (focusedNode: { i: number; j: number }) => {
      const focusMin =
        ff.getBarOffset(this.flamebearer.levels[focusedNode.i], focusedNode.j) / this.flamebearer.numTicks;
      const focusMax =
        (ff.getBarOffset(this.flamebearer.levels[focusedNode.i], focusedNode.j) +
          ff.getBarTotal(this.flamebearer.levels[focusedNode.i], focusedNode.j)) /
        this.flamebearer.numTicks;

      return {
        rangeMin: focusMin,
        rangeMax: focusMax,
      };
    };

    const { zoom, focusedNode } = this;

    return zoom.match({
      Just: (z) => {
        return focusedNode.match({
          // both are set
          Just: (f) => {
            const fRange = calculatedFocusRange(f);
            const zRange = calculatedZoomRange(z);

            // focus is smaller, let's use it
            if (fRange.rangeMax - fRange.rangeMin < zRange.rangeMax - zRange.rangeMin) {
              console.warn(
                'Focus is smaller than range, this shouldnt happen. Verify that the zoom is always bigger than the focus.'
              );
              return calculatedFocusRange(f);
            }

            return calculatedZoomRange(z);
          },

          // only zoom is set
          Nothing: () => {
            return calculatedZoomRange(z);
          },
        });
      },

      Nothing: () => {
        return focusedNode.match({
          Just: (f) => {
            // only focus is set
            return calculatedFocusRange(f);
          },
          Nothing: () => {
            // neither are set
            return {
              rangeMin: 0,
              rangeMax: 1,
            };
          },
        });
      },
    });
  }

  private getCanvasWidth() {
    // bit of a hack, but clientWidth is not available in node-canvas
    return this.canvas.clientWidth || this.canvas.width;
  }

  private isFocused() {
    return this.focusedNode.isJust;
  }

  // binary search of a block in a stack level
  // TODO(eh-am): calculations seem wrong when x is 0 and y != 0,
  // also on the border
  private binarySearchLevel(x: number, level: number[]) {
    const { ff } = this;

    let i = 0;
    let j = level.length - ff.jStep;

    while (i <= j) {
      /* eslint-disable-next-line no-bitwise */
      const m = ff.jStep * ((i / ff.jStep + j / ff.jStep) >> 1);
      const x0 = this.tickToX(ff.getBarOffset(level, m));
      const x1 = this.tickToX(ff.getBarOffset(level, m) + ff.getBarTotal(level, m));

      if (x0 <= x && x1 >= x) {
        return x1 - x0 > COLLAPSE_THRESHOLD ? m : -1;
      }
      if (x0 > x) {
        j = m - ff.jStep;
      } else {
        i = m + ff.jStep;
      }
    }
    return -1;
  }

  private xyToBarIndex(x: number, y: number) {
    if (x < 0 || y < 0) {
      throw new Error(`x and y must be bigger than 0. x = ${x}, y = ${y}`);
    }

    // clicked on the top bar and it's focused
    if (this.isFocused() && y <= BAR_HEIGHT) {
      return { i: 0, j: 0 };
    }

    // in focused mode there's a "fake" bar at the top
    // so we must discount for it
    const computedY = this.isFocused() ? y - BAR_HEIGHT : y;

    const compensatedFocusedY = this.focusedNode.mapOrElse(
      () => 0,
      (node) => {
        return node.i <= 0 ? 0 : node.i;
      }
    );

    const compensation = this.zoom.match({
      Just: () => {
        return this.focusedNode.match({
          Just: () => {
            // both are set, prefer focus
            return compensatedFocusedY;
          },

          Nothing: () => {
            // only zoom is set
            return 0;
          },
        });
      },

      Nothing: () => {
        return this.focusedNode.match({
          Just: () => {
            // only focus is set
            return compensatedFocusedY;
          },

          Nothing: () => {
            // none of them are set
            return 0;
          },
        });
      },
    });

    const i = Math.floor(computedY / PX_PER_LEVEL) + compensation;

    if (i >= 0 && i < this.flamebearer.levels.length) {
      const j = this.binarySearchLevel(x, this.flamebearer.levels[i]);

      return { i, j };
    }

    return { i: 0, j: 0 };
  }

  private parseXY(x: number, y: number) {
    const withinBounds = this.isWithinBounds(x, y);

    const v = { x, y } as XYWithinBounds;

    if (withinBounds) {
      return Maybe.of(v);
    }

    return Maybe.nothing<typeof v>();
  }

  private xyToBarPosition = (xy: XYWithinBounds) => {
    const { ff } = this;
    const { i, j } = this.xyToBarIndex(xy.x, xy.y);

    const topLevel = this.focusedNode.mapOrElse(
      () => 0,
      (node) => (node.i < 0 ? 0 : node.i - 1)
    );

    const level = this.flamebearer.levels[i];
    const posX = Math.max(this.tickToX(ff.getBarOffset(level, j)), 0);

    // lower bound is 0
    const posY = Math.max((i - topLevel) * PX_PER_LEVEL, 0);

    const sw = Math.min(
      this.tickToX(ff.getBarOffset(level, j) + ff.getBarTotal(level, j)) - posX,
      this.getCanvasWidth()
    );

    return {
      x: posX,
      y: posY,
      width: sw,
    };
  };

  private xyToBarData = (xy: XYWithinBounds) => {
    const { i, j } = this.xyToBarIndex(xy.x, xy.y);
    const level = this.flamebearer.levels[i];

    const { ff } = this;

    switch (this.flamebearer.format) {
      case 'single': {
        return {
          format: 'single' as const,
          name: this.flamebearer.names[ff.getBarName(level, j)],
          self: ff.getBarSelf(level, j),
          offset: ff.getBarOffset(level, j),
          total: ff.getBarTotal(level, j),
        };
      }
      case 'double': {
        return {
          format: 'double' as const,
          barTotal: ff.getBarTotal(level, j),
          //@ts-ignore
          totalLeft: ff?.getBarTotalLeft(level, j),
          //@ts-ignore
          totalRight: ff.getBarTotalRght(level, j),
          totalDiff: ff.getBarTotalDiff(level, j),
          name: this.flamebearer.names[ff.getBarName(level, j)],
        };
      }

      default: {
        throw new Error(`Unsupported type`);
      }
    }
  };

  isWithinBounds = (x: number, y: number) => {
    if (x < 0 || x > this.getCanvasWidth()) {
      return false;
    }

    try {
      const { i, j } = this.xyToBarIndex(x, y);
      if (j === -1 || i === -1) {
        return false;
      }
    } catch (e) {
      return false;
    }

    return true;
  };

  /*
   * Given x and y coordinates
   * return all information about the bar under those coordinates
   */
  xyToBar(x: number, y: number) {
    return this.parseXY(x, y).map((xyWithinBounds) => {
      const { i, j } = this.xyToBarIndex(x, y);
      const position = this.xyToBarPosition(xyWithinBounds);
      const data = this.xyToBarData(xyWithinBounds);

      return {
        //@ts-ignore
        x: xyWithinBounds.x,
        //@ts-ignore
        y: xyWithinBounds.y,
        i,
        j,
        ...position,
        ...data,
      };
    });
  }
}
