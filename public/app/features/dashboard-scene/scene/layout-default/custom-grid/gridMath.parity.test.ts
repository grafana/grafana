import { createElement } from 'react';
import { type PositionParams, calcGridItemPosition, calcWH } from 'react-grid-layout/build/calculateUtils';
import { type Position, resizeItemInDirection } from 'react-grid-layout/build/utils';

import {
  type GridLayoutItem,
  bottom,
  cellFromPixels,
  compact,
  containerHeightPx,
  normalizeLayout,
  pixelRectFor,
  previewInsert,
  previewMove,
  previewRemove,
  previewResize,
  sizeFromPixels,
} from './gridMath';

// gridMath calls react-grid-layout 1.4.4's layout functions, but the order it calls them in during drags,
// resizes, inserts and removals is its own. This fuzzes those sequences against the real ReactGridLayout
// component's handlers, configured the way SceneGridLayoutRenderer configures it. The pixel conversions
// GridItem does before calling the handlers are replayed with react-grid-layout's own helpers.

type V1Item = GridLayoutItem & { moved?: boolean; static?: boolean };

interface V1GridEvent {
  e: null;
  node: null;
  size?: Position;
  handle?: string;
}

interface V1Grid {
  state: { layout: V1Item[] };
  setState(partial: object): void;
  onDragStart(i: string, x: number, y: number, event: V1GridEvent): void;
  onDrag(i: string, x: number, y: number, event: V1GridEvent): void;
  onDragStop(i: string, x: number, y: number, event: V1GridEvent): void;
  onResizeStart(i: string, w: number, h: number, event: V1GridEvent): void;
  onResize(i: string, w: number, h: number, event: V1GridEvent): void;
  onResizeStop(i: string, w: number, h: number, event: V1GridEvent): void;
  containerHeight(): string | undefined;
}

interface V1GridClass {
  new (props: object): V1Grid;
  defaultProps: object;
}

const ReactGridLayout = jest.requireActual<{ default: V1GridClass }>('react-grid-layout/build/ReactGridLayout').default;

const NO_EVENT: V1GridEvent = { e: null, node: null };

function positionParams(containerWidth: number): PositionParams {
  return {
    cols: 24,
    margin: [8, 8],
    containerPadding: [0, 0],
    containerWidth,
    rowHeight: 30,
    maxRows: Infinity,
  };
}

// The component is driven without mounting it, so setState is applied synchronously by hand
function createV1Grid(layout: GridLayoutItem[], containerWidth = 1200): V1Grid {
  const grid = new ReactGridLayout({
    ...ReactGridLayout.defaultProps,
    width: containerWidth,
    cols: 24,
    rowHeight: 30,
    margin: [8, 8],
    containerPadding: [0, 0],
    isBounded: false,
    layout,
    children: layout.map((item) => createElement('div', { key: item.i })),
  });
  grid.setState = (partial: object) => {
    grid.state = { ...grid.state, ...partial };
  };
  return grid;
}

function plain(layout: GridLayoutItem[]): GridLayoutItem[] {
  return layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}

function find(layout: GridLayoutItem[], key: string): GridLayoutItem {
  const item = layout.find((candidate) => candidate.i === key);
  if (!item) {
    throw new Error(`missing item ${key}`);
  }
  return item;
}

// mulberry32
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const chance = (p: number) => next() < p;
  const pick = <T>(values: T[]): T => values[int(0, values.length - 1)];
  return { next, int, chance, pick };
}

type Random = ReturnType<typeof createRandom>;

const SEED = Number(process.env.GRID_FUZZ_SEED ?? 136417);

// Mirrors what scenes hands react-grid-layout from saved dashboards: finite numbers of any sign and
// size, unsorted relative to collisions, overlapping, sticking out of the grid, fractional
function messyLayout(random: Random): GridLayoutItem[] {
  const count = random.int(0, 14);
  const items: GridLayoutItem[] = [];
  for (let k = 0; k < count; k++) {
    const fraction = () => (random.chance(0.15) ? random.pick([0.25, 0.5, 0.75, 0.1]) : 0);
    const x = random.chance(0.85) ? random.int(0, 23) : random.int(-6, 34);
    const y = random.chance(0.1) ? random.int(500, 100000) : random.int(0, 40);
    const w = random.chance(0.8) ? random.int(1, 24) : random.int(-3, 40);
    const h = random.chance(0.85) ? random.int(1, 12) : random.int(-3, 30);
    items.push({ i: `p${k}`, x: x + fraction(), y: y + fraction(), w: w + fraction(), h: h + fraction() });
  }
  // scenes sorts cells by position before rendering
  return items.sort((a, b) => a.y - b.y || a.x - b.x);
}

function dashboardLayout(random: Random): GridLayoutItem[] {
  const count = random.int(1, 14);
  const items: GridLayoutItem[] = [];
  for (let k = 0; k < count; k++) {
    const w = random.pick([24, 12, 12, 8, 8, 6, 6, random.int(1, 24)]);
    const x = random.int(0, 24 - w);
    const fraction = random.chance(0.05) ? 0.5 : 0;
    items.push({ i: `p${k}`, x, y: random.int(0, 30) + fraction, w, h: random.int(1, 12) });
  }
  return normalizeLayout(items.sort((a, b) => a.y - b.y || a.x - b.x));
}

// Interactions mostly start from tidy dashboards, sometimes from whatever a messy saved layout normalized to
function interactionLayout(random: Random): GridLayoutItem[] {
  const messy = random.chance(0.25) ? normalizeLayout(messyLayout(random)) : [];
  return messy.length > 0 ? messy : dashboardLayout(random);
}

interface Mismatch {
  step: string;
  actual: unknown;
  expected: unknown;
}

function compare(step: string, actual: unknown, expected: unknown): Mismatch | null {
  try {
    expect(actual).toEqual(expected);
    return null;
  } catch {
    return { step, actual, expected };
  }
}

interface Scenario<C> {
  layout: GridLayoutItem[];
  keep?: string;
  case: C;
}

function stepsOf(testCase: object): unknown[] | undefined {
  return 'steps' in testCase && Array.isArray(testCase.steps) ? testCase.steps : undefined;
}

// Greedily drops layout items and steps while the case still fails, so a failure prints something small
function shrink<C extends object>(scenario: Scenario<C>, run: (s: Scenario<C>) => Mismatch | null): Scenario<C> {
  let current = scenario;
  let progress = true;
  while (progress) {
    progress = false;
    for (let k = 0; k < current.layout.length; k++) {
      if (current.layout[k].i === current.keep) {
        continue;
      }
      const candidate = { ...current, layout: current.layout.filter((_, index) => index !== k) };
      if (run(candidate)) {
        current = candidate;
        progress = true;
        break;
      }
    }
    const steps = stepsOf(current.case);
    for (let k = 0; !progress && steps && steps.length > 1 && k < steps.length; k++) {
      const candidate = { ...current, case: { ...current.case, steps: steps.filter((_, index) => index !== k) } };
      if (run(candidate)) {
        current = candidate;
        progress = true;
      }
    }
  }
  return current;
}

function fuzz<C extends object>(
  name: string,
  iterations: number,
  generate: (random: Random) => Scenario<C>,
  run: (s: Scenario<C>) => Mismatch | null
) {
  const random = createRandom(SEED);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const scenario = generate(random);
    const mismatch = run(scenario);
    if (mismatch) {
      const minimal = shrink(scenario, run);
      throw new Error(
        `${name} differs from react-grid-layout (GRID_FUZZ_SEED=${SEED}, iteration ${iteration}).\n` +
          `Minimal case: ${JSON.stringify(minimal)}\n` +
          `Mismatch: ${JSON.stringify(run(minimal) ?? mismatch)}`
      );
    }
  }
}

const containerWidths = [769, 1000, 1016, 1234.5, 1600, 2560];

describe('gridMath parity with react-grid-layout 1.4.4', () => {
  it('normalizes saved layouts identically', () => {
    fuzz(
      'normalizeLayout',
      3000,
      (random) => ({ layout: messyLayout(random), case: {} }),
      ({ layout }) => compare('normalize', normalizeLayout(layout), plain(createV1Grid(layout).state.layout))
    );
  });

  interface DragCase {
    containerWidth: number;
    steps: Array<{ left: number; top: number }>;
  }

  it('previews drags identically, step by step', () => {
    fuzz<DragCase>(
      'previewMove',
      1500,
      (random) => {
        const layout = interactionLayout(random);
        const keep = random.pick(layout).i;
        const containerWidth = random.pick(containerWidths);
        let { left, top } = pixelRectFor(containerWidth, find(layout, keep));
        const steps = Array.from({ length: random.int(1, 6) }, () => {
          if (random.chance(0.3)) {
            left = random.int(-100, containerWidth + 100);
            top = random.int(-100, containerHeightPx(layout) + 300);
          } else {
            left += random.int(-300, 300);
            top += random.int(-400, 400);
          }
          return { left, top };
        });
        return { layout, keep, case: { containerWidth, steps } };
      },
      ({ layout, keep, case: { containerWidth, steps } }) => {
        const key = keep!;
        const v1 = createV1Grid(layout, containerWidth);
        let ours = normalizeLayout(layout);
        const start = find(ours, key);
        v1.onDragStart(key, start.x, start.y, NO_EVENT);

        let last = { x: start.x, y: start.y };
        for (const [index, { left, top }] of steps.entries()) {
          const ourItem = find(ours, key);
          const cell = cellFromPixels(containerWidth, left, top, ourItem.w, ourItem.h);
          v1.onDrag(key, cell.x, cell.y, NO_EVENT);
          ours = previewMove(ours, key, cell.x, cell.y);
          const mismatch = compare(`drag ${index}`, ours, plain(v1.state.layout));
          if (mismatch) {
            return mismatch;
          }
          last = cell;
        }
        v1.onDragStop(key, last.x, last.y, NO_EVENT);
        return compare('drop', previewMove(ours, key, last.x, last.y), plain(v1.state.layout));
      }
    );
  });

  interface ResizeCase {
    containerWidth: number;
    steps: Array<{ width: number; height: number }>;
  }

  it('previews resizes from the bottom-right corner identically, step by step', () => {
    fuzz<ResizeCase>(
      'previewResize',
      1500,
      (random) => {
        const layout = interactionLayout(random);
        const keep = random.pick(layout).i;
        const containerWidth = random.pick(containerWidths);
        let { width, height } = pixelRectFor(containerWidth, find(layout, keep));
        const steps = Array.from({ length: random.int(1, 6) }, () => {
          if (random.chance(0.3)) {
            width = random.int(0, containerWidth + 200);
            height = random.int(0, 900);
          } else {
            width = Math.max(0, width + random.int(-250, 250));
            height = Math.max(0, height + random.int(-200, 300));
          }
          return { width, height };
        });
        return { layout, keep, case: { containerWidth, steps } };
      },
      ({ layout, keep, case: { containerWidth, steps } }) => {
        const key = keep!;
        const params = positionParams(containerWidth);
        const v1 = createV1Grid(layout, containerWidth);
        let ours = normalizeLayout(layout);
        const start = find(ours, key);
        v1.onResizeStart(key, start.w, start.h, NO_EVENT);

        // GridItem keeps the last pixel size it reported and constrains the next one against it
        let resizing: Position | null = null;
        let last = { w: start.w, h: start.h };
        for (const [index, size] of steps.entries()) {
          const v1Item = find(v1.state.layout, key);
          const position = calcGridItemPosition(params, v1Item.x, v1Item.y, v1Item.w, v1Item.h, { resizing });
          const updated = resizeItemInDirection('se', position, size, containerWidth);
          resizing = updated;
          const raw = calcWH(params, updated.width, updated.height, v1Item.x, v1Item.y, 'se');
          const v1Size = { w: Math.max(raw.w, 1), h: Math.max(raw.h, 1) };

          const ourSize = sizeFromPixels(containerWidth, find(ours, key), size);
          const sizeMismatch = compare(`size ${index}`, ourSize, v1Size);
          if (sizeMismatch) {
            return sizeMismatch;
          }
          v1.onResize(key, v1Size.w, v1Size.h, { ...NO_EVENT, size: updated, handle: 'se' });
          ours = previewResize(ours, key, ourSize.w, ourSize.h);
          const mismatch = compare(`resize ${index}`, ours, plain(v1.state.layout));
          if (mismatch) {
            return mismatch;
          }
          last = ourSize;
        }
        v1.onResizeStop(key, last.w, last.h, NO_EVENT);
        return compare('resize stop', compact(ours), plain(v1.state.layout));
      }
    );
  });

  interface InsertCase {
    item: GridLayoutItem;
    containerWidth: number;
    left: number;
    top: number;
  }

  it('previews inserting an item as a drag in from below the last row', () => {
    fuzz<InsertCase>(
      'previewInsert',
      1000,
      (random) => {
        const containerWidth = random.pick(containerWidths);
        return {
          layout: interactionLayout(random),
          case: {
            item: { i: 'new', x: 0, y: 0, w: random.pick([24, 12, 8, 6, random.int(1, 24)]), h: random.int(1, 10) },
            containerWidth,
            left: random.int(-50, containerWidth),
            top: random.int(-50, 900),
          },
        };
      },
      ({ layout, case: { item, containerWidth, left, top } }) => {
        const { x, y } = cellFromPixels(containerWidth, left, top, item.w, item.h);
        // A drag of an item that sits below the last row, without letting the grid compact it first
        const v1 = createV1Grid(layout, containerWidth);
        const below = { ...item, x: 0, y: bottom(v1.state.layout) };
        v1.setState({ layout: [...v1.state.layout, below] });
        v1.onDragStart(item.i, below.x, below.y, NO_EVENT);
        v1.onDrag(item.i, x, y, NO_EVENT);
        return compare('insert', previewInsert(layout, item, x, y), plain(v1.state.layout));
      }
    );
  });

  it('previews removing an item identically', () => {
    fuzz(
      'previewRemove',
      500,
      (random) => {
        const layout = interactionLayout(random);
        return { layout, keep: random.pick(layout).i, case: {} };
      },
      ({ layout, keep }) => {
        const v1 = createV1Grid(layout.filter((item) => item.i !== keep));
        return compare('remove', previewRemove(layout, keep!), plain(v1.state.layout));
      }
    );
  });

  it('computes the same container height for non-empty layouts', () => {
    fuzz(
      'containerHeightPx',
      1000,
      (random) => ({ layout: dashboardLayout(random), case: {} }),
      ({ layout }) => {
        if (layout.length === 0) {
          return null;
        }
        return compare(
          'height',
          `${containerHeightPx(normalizeLayout(layout))}px`,
          createV1Grid(layout).containerHeight()
        );
      }
    );
  });
});
