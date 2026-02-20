import { act, renderHook } from '@testing-library/react';

import { buildVizAndDataPaneGrid, getDefaultSidebarRatio, useRatioResize } from './hooks';

jest.mock('@grafana/ui', () => ({
  useStyles2: jest.fn(() => ({ dragHandleVertical: '', dragHandleHorizontal: '' })),
  getDragStyles: jest.fn(),
}));

describe('buildVizAndDataPaneGrid', () => {
  const base = {
    controlsEnabled: false,
    hasDataPane: true,
    isSidebarFullWidth: false,
    vizRatio: 0.5,
    sidebarRatio: 0.25,
  };

  it('omits sidebar and data-pane areas when there is no data pane', () => {
    const { gridTemplateAreas } = buildVizAndDataPaneGrid({ ...base, hasDataPane: false });

    expect(gridTemplateAreas).toBe('"viz viz"');
  });

  it('adds a controls row first when controls are enabled', () => {
    const { gridTemplateAreas, gridTemplateRows } = buildVizAndDataPaneGrid({ ...base, controlsEnabled: true });

    expect(gridTemplateAreas).toMatch(/^"controls controls"/);
    expect(gridTemplateRows).toMatch(/^auto/);
  });

  it("replaces every grid area's left column with sidebar when isSidebarFullWidth", () => {
    const { gridTemplateAreas } = buildVizAndDataPaneGrid({ ...base, controlsEnabled: true, isSidebarFullWidth: true });

    const leftAreas = gridTemplateAreas.split('\n').map((row) => row.replace(/"/g, '').trim().split(' ')[0]);
    expect(leftAreas.every((area) => area === 'sidebar')).toBe(true);
  });

  it('converts vizRatio to the correct fr value', () => {
    // 0.5 → 0.5/0.5 = 1fr,  0.75 → 0.75/0.25 = 3fr
    expect(buildVizAndDataPaneGrid({ ...base, vizRatio: 0.5 }).gridTemplateRows).toMatch(/^1fr/);
    expect(buildVizAndDataPaneGrid({ ...base, vizRatio: 0.75 }).gridTemplateRows).toMatch(/^3fr/);
  });

  it('converts sidebarRatio to the correct fr value', () => {
    // 0.5 → 0.5/0.5 = 1fr 1fr
    expect(buildVizAndDataPaneGrid({ ...base, sidebarRatio: 0.5 }).gridTemplateColumns).toMatch(/^1fr/);

    // 0.25 → 0.25/0.75 ≈ 0.333fr
    const [sidebarFr] = buildVizAndDataPaneGrid({ ...base, sidebarRatio: 0.25 }).gridTemplateColumns.split(' ');
    expect(parseFloat(sidebarFr)).toBeCloseTo(1 / 3, 5);
  });
});

// ---------------------------------------------------------------------------
// getDefaultSidebarRatio
// ---------------------------------------------------------------------------

describe('getDefaultSidebarRatio', () => {
  it.each([
    [3840, 0.15, '>= 2200px (4K)'],
    [2200, 0.15, '= 2200px (boundary)'],
    [2199, 0.2, '< 2200px'],
    [1800, 0.2, '>= 1800px (FHD)'],
    [1799, 0.25, '< 1800px (laptop)'],
    [1280, 0.25, 'small laptop'],
  ])('returns %f for %ipx (%s)', (width, expected) => {
    expect(getDefaultSidebarRatio(width)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// useRatioResize
// ---------------------------------------------------------------------------

function makeContainerRef(width: number, height: number) {
  const el = document.createElement('div');
  jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
  return { current: el };
}

function makeHandle() {
  const el = document.createElement('div');
  el.setPointerCapture = jest.fn();
  el.releasePointerCapture = jest.fn();
  return el;
}

function dragHandle(handle: HTMLElement, startClientX: number, endClientX: number) {
  handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: startClientX, bubbles: true }));
  handle.dispatchEvent(new PointerEvent('pointermove', { clientX: endClientX, bubbles: true }));
}

describe('useRatioResize', () => {
  it('applies getDefaultRatio once at mount using the measured container size', () => {
    const getDefaultRatio = jest.fn((width: number) => (width >= 2000 ? 0.15 : 0.25));

    const { result } = renderHook(() =>
      useRatioResize({
        direction: 'horizontal',
        initialRatio: 0.5,
        containerRef: makeContainerRef(2400, 500),
        getDefaultRatio,
      })
    );

    expect(getDefaultRatio).toHaveBeenCalledTimes(1);
    expect(getDefaultRatio).toHaveBeenCalledWith(2400);
    expect(result.current.ratio).toBe(0.15);
  });

  it('does not let the ratio fall below minRatio', () => {
    const { result } = renderHook(() =>
      useRatioResize({
        direction: 'horizontal',
        initialRatio: 0.5,
        containerRef: makeContainerRef(1000, 500),
        minRatio: 0.2,
      })
    );

    const handle = makeHandle();
    act(() => {
      result.current.handleRef(handle);
      // Drag so far left that the unclamped ratio would be negative
      dragHandle(handle, 500, 0);
    });

    expect(result.current.ratio).toBe(0.2);
  });

  it('does not let the ratio exceed maxRatio', () => {
    const { result } = renderHook(() =>
      useRatioResize({
        direction: 'horizontal',
        initialRatio: 0.5,
        containerRef: makeContainerRef(1000, 500),
        maxRatio: 0.8,
      })
    );

    const handle = makeHandle();
    act(() => {
      result.current.handleRef(handle);
      // Drag so far right that the unclamped ratio would exceed 1
      dragHandle(handle, 500, 1000);
    });

    expect(result.current.ratio).toBe(0.8);
  });

  it('removes the pointerdown listener when the ref is called with null (cleanup)', () => {
    const { result } = renderHook(() =>
      useRatioResize({ direction: 'horizontal', initialRatio: 0.5, containerRef: makeContainerRef(1000, 500) })
    );

    const handle = makeHandle();
    const removeSpy = jest.spyOn(handle, 'removeEventListener');

    act(() => {
      result.current.handleRef(handle);
      result.current.handleRef(null);
    });

    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
  });
});
