import { act, renderHook } from '@testing-library/react';

import { useSplitter } from '@grafana/ui';
import { MIN_SUGGESTIONS_PANE_WIDTH } from 'app/features/panel/suggestions/constants';

import { useSnappingSplitter } from './useSnappingSplitter';

jest.mock('@grafana/ui', () => ({
  useSplitter: jest.fn((options) => ({
    containerProps: { className: '' },
    primaryProps: { className: '', style: {} },
    secondaryProps: { className: '', style: {} },
    splitterProps: { style: {} },
    options,
  })),
}));

describe('useSnappingSplitter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderColumnSplitter(onPaneSizeChanged = jest.fn()) {
    renderHook(() =>
      useSnappingSplitter({
        direction: 'column',
        collapseBelowPixels: 150,
        usePixels: true,
        onPaneSizeChanged,
      })
    );

    return {
      onPaneSizeChanged,
      splitterOptions: jest.mocked(useSplitter).mock.results[0].value.options,
    };
  }

  function renderPrimaryPixelSplitter(onPaneSizeChanged = jest.fn()) {
    renderHook(() =>
      useSnappingSplitter({
        direction: 'row',
        collapseBelowPixels: 150,
        usePixels: true,
        pixelPane: 'primary',
        onPaneSizeChanged,
      })
    );

    return {
      onPaneSizeChanged,
      splitterOptions: jest.mocked(useSplitter).mock.results[0].value.options,
    };
  }

  it('reports the settled secondary pane size when it remains expanded', () => {
    const { onPaneSizeChanged, splitterOptions } = renderColumnSplitter();

    expect(splitterOptions.onSizeChanged).toBeDefined();
    act(() => {
      splitterOptions.onSizeChanged?.(0.5, 500, 240);
    });

    expect(onPaneSizeChanged).toHaveBeenCalledWith(240, expect.any(Number));
  });

  it('does not persist a size below the collapse threshold', () => {
    const { onPaneSizeChanged, splitterOptions } = renderColumnSplitter();

    expect(splitterOptions.onSizeChanged).toBeDefined();
    act(() => {
      splitterOptions.onSizeChanged?.(0.9, 500, 120);
    });

    expect(onPaneSizeChanged).not.toHaveBeenCalled();
  });

  it('forwards pixelPane to the underlying splitter when pinning the primary pane', () => {
    const { splitterOptions } = renderPrimaryPixelSplitter();

    expect(splitterOptions.pixelPane).toBe('primary');
    expect(splitterOptions.usePixels).toBe(true);
  });

  it('reports the settled primary pane size when collapsing the primary pane', () => {
    const { onPaneSizeChanged, splitterOptions } = renderPrimaryPixelSplitter();

    act(() => {
      splitterOptions.onSizeChanged?.(1, 300, 600);
    });

    expect(onPaneSizeChanged).toHaveBeenCalledWith(300, expect.any(Number));
  });

  it('does not persist a primary pane size below the collapse threshold', () => {
    const { onPaneSizeChanged, splitterOptions } = renderPrimaryPixelSplitter();

    act(() => {
      splitterOptions.onSizeChanged?.(1, 120, 600);
    });

    expect(onPaneSizeChanged).not.toHaveBeenCalled();
  });

  describe('collapse and restore', () => {
    const THRESHOLD = 150;
    const CONFIGURED_SIZE = 350;

    /**
     * Reads the callbacks the hook most recently handed to `useSplitter`, so a drag sequence
     * exercises whatever the component would actually call at that point in the gesture.
     */
    function latestOptions() {
      const { calls } = jest.mocked(useSplitter).mock;
      return calls[calls.length - 1][0];
    }

    function renderSplitter(pixelPane: 'primary' | 'secondary', collapsed?: boolean) {
      const onPaneSizeChanged = jest.fn();
      const { result } = renderHook(() =>
        useSnappingSplitter({
          direction: pixelPane === 'primary' ? 'row' : 'column',
          collapseBelowPixels: THRESHOLD,
          usePixels: true,
          pixelPane,
          initialSize: CONFIGURED_SIZE,
          collapsed,
          onPaneSizeChanged,
        })
      );

      // The pinned pane is the one that collapses; the other fills the remaining space.
      const collapsingStyle = () =>
        pixelPane === 'primary' ? result.current.primaryProps.style : result.current.secondaryProps.style;

      return { result, onPaneSizeChanged, collapsingStyle };
    }

    /** A full drag gesture: pointer moves (onResizing), then settles (onSizeChanged). */
    function drag(pixelPane: 'primary' | 'secondary', panePixels: number) {
      const args: [number, number, number] = pixelPane === 'primary' ? [1, panePixels, 600] : [0.5, 600, panePixels];

      act(() => {
        latestOptions().onResizing?.(...args);
      });
      act(() => {
        latestOptions().onSizeChanged?.(...args);
      });
    }

    describe.each(['primary', 'secondary'] as const)('%s pane', (pixelPane) => {
      it('collapses when a drag settles below the threshold', () => {
        const { result, collapsingStyle } = renderSplitter(pixelPane);

        drag(pixelPane, THRESHOLD - 30);

        expect(result.current.splitterState.collapsed).toBe(true);
        // Fully closed, but min-content keeps the expand affordance visible.
        expect(collapsingStyle().flexBasis).toBe('0px');
        expect(collapsingStyle().minWidth).toBe('min-content');
        expect(collapsingStyle().overflow).toBe('unset');
      });

      it('stays expanded when a drag settles above the threshold', () => {
        const { result, onPaneSizeChanged, collapsingStyle } = renderSplitter(pixelPane);

        drag(pixelPane, THRESHOLD + 100);

        expect(result.current.splitterState.collapsed).toBe(false);
        // No size override while open, so the pane keeps the size useSplitter applied.
        expect(collapsingStyle().flexBasis).toBeUndefined();
        expect(onPaneSizeChanged).toHaveBeenCalledWith(THRESHOLD + 100, expect.any(Number));
      });

      it('restores the configured size when expanded via the toggle', () => {
        const { result, collapsingStyle } = renderSplitter(pixelPane);

        drag(pixelPane, THRESHOLD - 30);
        expect(collapsingStyle().flexBasis).toBe('0px');

        act(() => {
          result.current.onToggleCollapse();
        });

        expect(result.current.splitterState.collapsed).toBe(false);
        // Override cleared, so the pane falls back to useSplitter's initialSize sizing.
        expect(collapsingStyle().flexBasis).toBeUndefined();
      });

      // Guards the behaviour asked for in review: a size too small to be usable must never become
      // the size the pane is restored to.
      it('leaves the persisted size untouched when collapsing', () => {
        const { onPaneSizeChanged } = renderSplitter(pixelPane);

        drag(pixelPane, 300);
        expect(onPaneSizeChanged).toHaveBeenLastCalledWith(300, expect.any(Number));

        drag(pixelPane, THRESHOLD - 30);

        // Still 300 — the sub-threshold size was not persisted over it.
        expect(onPaneSizeChanged).toHaveBeenLastCalledWith(300, expect.any(Number));
        expect(onPaneSizeChanged).not.toHaveBeenCalledWith(THRESHOLD - 30, expect.any(Number));
      });

      it('reopens when a collapsed pane is dragged back past the threshold', () => {
        const { result } = renderSplitter(pixelPane, true);

        expect(result.current.splitterState.collapsed).toBe(true);

        act(() => {
          const args: [number, number, number] =
            pixelPane === 'primary' ? [1, THRESHOLD + 100, 600] : [0.5, 600, THRESHOLD + 100];
          latestOptions().onResizing?.(...args);
        });

        expect(result.current.splitterState.collapsed).toBe(false);
      });

      it('starts collapsed when the collapsed option is set', () => {
        const { result, collapsingStyle } = renderSplitter(pixelPane, true);

        expect(result.current.splitterState.collapsed).toBe(true);
        expect(collapsingStyle().flexBasis).toBe('0px');
      });

      // A real gesture delivers the final pointermove and the pointerup in the same React commit,
      // so neither callback sees the other's update applied. The pane must still end up fully
      // closed rather than stranded at the size it was dragged to.
      it('completes the collapse when the drag settles in the same commit', () => {
        const { result, collapsingStyle } = renderSplitter(pixelPane);
        const args: [number, number, number] =
          pixelPane === 'primary' ? [1, THRESHOLD - 30, 600] : [0.5, 600, THRESHOLD - 30];

        // One batch, no render in between — the shape that used to strand the pane.
        const settled = latestOptions();
        act(() => {
          settled.onResizing?.(...args);
          settled.onSizeChanged?.(...args);
        });

        expect(result.current.splitterState.collapsed).toBe(true);
        expect(collapsingStyle().flexBasis).toBe('0px');
        expect(collapsingStyle().minWidth).toBe('min-content');
      });

      // `snapSize` pins the pane on every render. Once the pane is open it has to be released, or
      // the re-render caused by persisting the new size snaps the pane straight back.
      it('releases the forced size so a later resize is not undone', () => {
        const { result, collapsingStyle } = renderSplitter(pixelPane, true);

        // Nudge open below the threshold — this is what leaves a snapSize behind.
        drag(pixelPane, THRESHOLD - 30);
        expect(result.current.splitterState.collapsed).toBe(false);
        expect(collapsingStyle().flexBasis).toBe(`${CONFIGURED_SIZE}px`);

        // Now resize it properly.
        drag(pixelPane, 500);

        expect(result.current.splitterState.snapSize).toBeUndefined();
        expect(collapsingStyle().flexBasis).toBeUndefined();
      });

      it('reports the primary pane flex ratio alongside the pixel size', () => {
        const { onPaneSizeChanged } = renderSplitter(pixelPane);
        const flex = pixelPane === 'primary' ? 1 : 0.5;

        act(() => {
          latestOptions().onSizeChanged?.(
            ...((pixelPane === 'primary' ? [flex, 400, 600] : [flex, 600, 400]) as [number, number, number])
          );
        });

        expect(onPaneSizeChanged).toHaveBeenCalledWith(400, flex);
      });

      // Nudging a closed pane without clearing the threshold reopens it at the configured size
      // rather than the tiny dragged size.
      it('reopens to at least the configured size when nudged below the threshold', () => {
        const { result, collapsingStyle } = renderSplitter(pixelPane, true);

        drag(pixelPane, THRESHOLD - 30);

        expect(result.current.splitterState.collapsed).toBe(false);
        expect(collapsingStyle().flexBasis).toBe(`${CONFIGURED_SIZE}px`);
      });
    });
  });

  /**
   * The options pane is the one consumer outside the query editor, and it is not behind a feature
   * flag. `useSplitter` reports a double-click through `onSizeChanged` with no preceding
   * `onResizing` — that absence is what distinguishes the gesture from a drag here.
   */
  describe('double-click reset, options pane config', () => {
    // Mirrors `PanelEditorRenderer` and `usePanelEditorShell`, which both hard-code these. Only the
    // threshold can be imported; if the 330 there ever drops below it, the last case fails.
    const RESET_SIZE = 330;
    const PANE_PADDING = 16;
    const THRESHOLD = MIN_SUGGESTIONS_PANE_WIDTH + PANE_PADDING;

    function latestOptions() {
      const { calls } = jest.mocked(useSplitter).mock;
      return calls[calls.length - 1][0];
    }

    function mountOptionsPaneSplitter(collapsed?: boolean) {
      const { result } = renderHook(() =>
        useSnappingSplitter({
          direction: 'row',
          dragPosition: 'end',
          usePixels: true,
          initialSize: RESET_SIZE,
          collapseBelowPixels: THRESHOLD,
          collapsed,
          // No `onPaneSizeChanged` — the options pane does not persist its width.
        })
      );

      return result;
    }

    /** Settle at `panePixels` without any pointer move first, the way a double-click arrives. */
    function doubleClick(panePixels: number) {
      act(() => {
        latestOptions().onSizeChanged?.(0.5, 600, panePixels);
      });
    }

    it('expands a collapsed pane to the reset size', () => {
      const result = mountOptionsPaneSplitter(true);
      expect(result.current.splitterState.collapsed).toBe(true);

      doubleClick(RESET_SIZE);

      expect(result.current.splitterState.collapsed).toBe(false);
      expect(result.current.secondaryProps.style.flexBasis).toBe(`${RESET_SIZE}px`);
    });

    it('leaves an open pane open and unforced', () => {
      const result = mountOptionsPaneSplitter();

      doubleClick(RESET_SIZE);

      expect(result.current.splitterState.collapsed).toBe(false);
      // No snapSize override, so the pane keeps the size useSplitter wrote to the DOM.
      expect(result.current.splitterState.snapSize).toBeUndefined();
      expect(result.current.secondaryProps.style.flexBasis).toBeUndefined();
    });

    // The reset size clears the collapse threshold by only ~54px. Were that margin ever lost, a
    // double-click would start *collapsing* the options pane for every user, flag or not.
    it('does not collapse the pane at its configured reset size', () => {
      const result = mountOptionsPaneSplitter();

      doubleClick(RESET_SIZE);

      expect(RESET_SIZE).toBeGreaterThanOrEqual(THRESHOLD);
      expect(result.current.splitterState.collapsed).toBe(false);
    });
  });
});
