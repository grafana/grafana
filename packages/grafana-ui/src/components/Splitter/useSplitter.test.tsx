import { fireEvent, render, renderHook, screen } from '@testing-library/react';

import { useSplitter, type UseSplitterOptions } from './useSplitter';

function Splitter(options: UseSplitterOptions) {
  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter(options);

  return (
    <div {...containerProps}>
      <div {...primaryProps} />
      <div {...splitterProps} />
      <div {...secondaryProps} />
    </div>
  );
}

describe('useSplitter', () => {
  describe('flex sizing (default)', () => {
    it('splits both panes by flexGrow and pins neither to pixels', () => {
      const { result } = renderHook(() => useSplitter({ direction: 'row', initialSize: 0.5 }));
      const { style: primary } = result.current.primaryProps;
      const { style: secondary } = result.current.secondaryProps;

      expect(primary.flexGrow).toBe(0.5);
      expect(secondary.flexGrow).toBe(0.5);
      expect(primary.flexBasis).toBeUndefined();
      expect(secondary.flexBasis).toBeUndefined();
    });

    it('ignores pixelPane when usePixels is not set', () => {
      const { result } = renderHook(() => useSplitter({ direction: 'row', pixelPane: 'primary', initialSize: 0.5 }));
      const { style: primary } = result.current.primaryProps;

      expect(primary.flexGrow).toBe(0.5);
      expect(primary.flexBasis).toBeUndefined();
    });
  });

  describe('pixel sizing', () => {
    it('pins the secondary pane by default', () => {
      const { result } = renderHook(() => useSplitter({ direction: 'row', usePixels: true, initialSize: 330 }));
      const { style: primary } = result.current.primaryProps;
      const { style: secondary } = result.current.secondaryProps;

      expect(secondary.flexBasis).toBe('330px');
      expect(secondary.flexGrow).toBe('unset');
      expect(primary.flexGrow).toBe(1);
      expect(primary.flexBasis).toBeUndefined();
    });

    it('pins the primary pane when pixelPane is "primary"', () => {
      const { result } = renderHook(() =>
        useSplitter({ direction: 'row', usePixels: true, pixelPane: 'primary', initialSize: 330 })
      );
      const { style: primary } = result.current.primaryProps;
      const { style: secondary } = result.current.secondaryProps;

      expect(primary.flexBasis).toBe('330px');
      expect(primary.flexGrow).toBe('unset');
      expect(secondary.flexGrow).toBe(1);
      expect(secondary.flexBasis).toBeUndefined();
    });
  });

  // Double-click resets the panes by writing styles straight to the DOM. It has to report that reset
  // too: a consumer holding the size outside the DOM (to survive a remount, say) would otherwise
  // keep the pre-reset value and put it back on the next render.
  describe('double-click reset', () => {
    const CONTAINER = 1000;
    const HANDLE = 16;

    /** jsdom has no layout, so give the container and the panes fixed sizes to measure. */
    function stubLayout(containerEl: Element, paneSize: number) {
      jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const size = this === containerEl ? CONTAINER : paneSize;
        return { width: size, height: size } as DOMRect;
      });
    }

    function mountSplitter(options: UseSplitterOptions, paneSize: number) {
      const { container } = render(<Splitter {...options} />);
      stubLayout(container.firstElementChild!, paneSize);

      return screen.getByRole('separator');
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('reports the even split for a flex-sized splitter', () => {
      const onSizeChanged = jest.fn();
      const halfPane = (CONTAINER - HANDLE) / 2;
      const separator = mountSplitter({ direction: 'row', initialSize: 0.8, onSizeChanged }, halfPane);

      fireEvent.doubleClick(separator);

      expect(onSizeChanged).toHaveBeenCalledWith(0.5, halfPane, halfPane);
    });

    // The branch the options pane takes. It is not behind a feature flag, so this is the reset that
    // reaches every user — the pane it reports must clear its own collapse threshold.
    it('reports the configured size for a secondary-pixel splitter', () => {
      const onSizeChanged = jest.fn();
      const primaryPane = CONTAINER - 330 - HANDLE;
      const separator = mountSplitter(
        { direction: 'row', usePixels: true, initialSize: 330, onSizeChanged },
        primaryPane
      );

      fireEvent.doubleClick(separator);

      // Primary keeps flexGrow 1 in this mode, so the reported ratio is 1 and the pinned pane is 330.
      expect(onSizeChanged).toHaveBeenCalledWith(1, primaryPane, 330);
    });

    it('reports the configured size for a primary-pixel splitter', () => {
      const onSizeChanged = jest.fn();
      const separator = mountSplitter(
        { direction: 'row', usePixels: true, pixelPane: 'primary', initialSize: 330, onSizeChanged },
        330
      );

      fireEvent.doubleClick(separator);

      expect(onSizeChanged).toHaveBeenCalledWith(330 / (CONTAINER - HANDLE), 330, CONTAINER - 330 - HANDLE);
    });
  });
});
