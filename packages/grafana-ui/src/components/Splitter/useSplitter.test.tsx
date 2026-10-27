import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from '../Button/Button';
import { Dropdown } from '../Dropdown/Dropdown';
import { Menu } from '../Menu/Menu';

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

interface TestProps extends UseSplitterOptions {
  primaryWidth: number;
  containerWidth: number;
}

/**
 * jsdom has no layout, so every getBoundingClientRect is 0. The hook reads widths from the DOM to
 * decide how far a drag may go, so each pane is stubbed with the width the test needs.
 */
function TestSplitter({ primaryWidth, containerWidth, ...options }: TestProps) {
  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter(options);

  const stubWidth = (width: number) => (el: HTMLDivElement | null) => {
    if (el) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      el.getBoundingClientRect = () =>
        ({
          width,
          height: 100,
          top: 0,
          left: 0,
          right: width,
          bottom: 100,
          x: 0,
          y: 0,
        }) as DOMRect;
    }
  };

  return (
    <div
      {...containerProps}
      ref={(el) => {
        stubWidth(containerWidth)(el);
        containerProps.ref.current = el;
      }}
    >
      <div
        {...primaryProps}
        ref={(el) => {
          stubWidth(primaryWidth)(el);
          primaryProps.ref.current = el;
        }}
      />
      <div {...splitterProps} />
      <div
        {...secondaryProps}
        ref={(el) => {
          stubWidth(containerWidth - primaryWidth)(el);
          secondaryProps.ref.current = el;
        }}
      />
    </div>
  );
}

async function dragSplitterBy(pixels: number) {
  const splitter = screen.getByRole('separator');
  splitter.setPointerCapture = jest.fn();
  splitter.releasePointerCapture = jest.fn();

  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: splitter, coords: { clientX: 0, clientY: 0 } },
    { target: splitter, coords: { clientX: pixels, clientY: 0 } },
  ]);
}

describe('useSplitter', () => {
  describe('accessibility', () => {
    it('removes an aria-hidden handle from the tab order and restores it when shown', async () => {
      render(<Splitter direction="row" />);
      const handle = screen.getByRole('separator', { name: 'Pane resize widget' });
      expect(handle).toHaveAttribute('tabindex', '0');

      handle.setAttribute('aria-hidden', 'true');
      await waitFor(() => expect(handle).toHaveAttribute('tabindex', '-1'));

      handle.removeAttribute('aria-hidden');
      await waitFor(() => expect(handle).toHaveAttribute('tabindex', '0'));
      handle.focus();
      expect(handle).toHaveFocus();
    });

    it('keeps a handle out of the tab order while a dropdown hides its ancestor', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Splitter direction="row" />
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item label="Example action" />
              </Menu>
            }
          >
            <Button>Open menu</Button>
          </Dropdown>
        </>
      );
      const handle = screen.getByRole('separator', { name: 'Pane resize widget' });
      const trigger = screen.getByRole('button', { name: 'Open menu' });

      await user.click(trigger);
      expect(await screen.findByRole('menuitem', { name: 'Example action' })).toBeVisible();
      expect(handle.closest('[aria-hidden="true"]')).not.toBeNull();
      await waitFor(() => expect(handle).toHaveAttribute('tabindex', '-1'));

      await user.keyboard('{Escape}');
      await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
      await waitFor(() => expect(handle).toHaveAttribute('tabindex', '0'));
      handle.focus();
      expect(handle).toHaveFocus();
    });
  });

  // `handlePressedKeys` measures the pane, then resizes it. Reporting that measurement on key-up
  // reports where the pane was a frame ago, which a consumer persisting the size would save.
  describe('keyboard', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('reports the size the pane ended at on key-up', async () => {
      const onSizeChanged = jest.fn();
      // No animation frame runs between the keys, so only key-up itself can see the new size.
      jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
      let primaryWidth = 300;
      const { container } = render(
        <Splitter direction="row" usePixels pixelPane="primary" initialSize={300} onSizeChanged={onSizeChanged} />
      );
      const containerEl = container.firstElementChild!;
      const primaryEl = containerEl.firstElementChild!;
      jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const width = this === containerEl ? 1016 : this === primaryEl ? primaryWidth : 0;
        return { width, height: 100 } as DOMRect;
      });

      const user = userEvent.setup();
      screen.getByRole('separator').focus();
      await user.keyboard('{ArrowLeft>}');
      primaryWidth = 258;
      await user.keyboard('{/ArrowLeft}');

      expect(onSizeChanged).toHaveBeenCalledWith(expect.any(Number), 258, 1016 - 258 - 16);
    });
  });

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

    // A primary-pixel pane's handle sits after its width, so an oversized basis would push the
    // handle outside the container's clipped edge and leave nothing to drag it back with.
    it('caps the primary pane so its handle stays inside the container', () => {
      const { result } = renderHook(() =>
        useSplitter({ direction: 'row', usePixels: true, pixelPane: 'primary', initialSize: 1800 })
      );
      const { style: primary } = result.current.primaryProps;

      expect(primary.maxWidth).toBe('calc(100% - 16px)');
      expect(primary.maxHeight).toBeUndefined();
    });

    it('caps along the cross axis for a column splitter', () => {
      const { result } = renderHook(() =>
        useSplitter({ direction: 'column', usePixels: true, pixelPane: 'primary', initialSize: 1800 })
      );
      const { style: primary } = result.current.primaryProps;

      expect(primary.maxHeight).toBe('calc(100% - 16px)');
      expect(primary.maxWidth).toBeUndefined();
    });

    // The secondary pane's handle sits before its width, so it stays reachable without a cap.
    it('does not cap a secondary-pixel pane', () => {
      const { result } = renderHook(() => useSplitter({ direction: 'row', usePixels: true, initialSize: 1800 }));
      const { style: secondary } = result.current.secondaryProps;

      expect(secondary.maxWidth).toBeUndefined();
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

    // A consumer that restores a stored size passes it as `initialSize`, so resetting to that would
    // leave the pane where it already is.
    it('resets to resetSize instead of initialSize when given', () => {
      const separator = mountSplitter(
        { direction: 'row', usePixels: true, pixelPane: 'primary', initialSize: 600, resetSize: 350 },
        350
      );

      fireEvent.doubleClick(separator);

      expect(document.getElementById(separator.getAttribute('aria-controls')!)?.style.flexBasis).toBe('350px');
    });
  });

  // `aria-valuenow` must sit inside the 0-100 range the separator declares, whatever the sizing mode.
  describe('aria-valuenow', () => {
    it('reports the primary pane share of the container for a pixel splitter', () => {
      render(
        <TestSplitter
          direction="row"
          usePixels
          pixelPane="primary"
          initialSize={350}
          primaryWidth={350}
          containerWidth={1016}
        />
      );

      // 350 of the 1000px beside the 16px handle.
      expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '35');
    });

    // The query editor sidebar calls the hook before its panes render, so a mount-only measurement
    // finds no elements and the separator never gets a value.
    it('reports a value for panes that mount after the hook', () => {
      function LateSplitter({ showPanes }: { showPanes: boolean }) {
        const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
          direction: 'row',
          usePixels: true,
          pixelPane: 'primary',
          initialSize: 350,
        });

        return showPanes ? (
          <div {...containerProps}>
            <div {...primaryProps} />
            <div {...splitterProps} />
            <div {...secondaryProps} />
          </div>
        ) : null;
      }

      const { rerender } = render(<LateSplitter showPanes={false} />);
      rerender(<LateSplitter showPanes />);

      expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow');
    });

    it('stays in range while dragging a pixel splitter', async () => {
      render(<TestSplitter direction="row" usePixels initialSize={330} primaryWidth={670} containerWidth={1016} />);

      await dragSplitterBy(50);

      const value = Number(screen.getByRole('separator').getAttribute('aria-valuenow'));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });
  });

  // A pane with its min size unset can be dragged fully closed. The drag handler reads a measured
  // size where 0 is legitimate, so it must not treat a collapsed pane as an unmeasured one.
  describe('dragging', () => {
    it('keeps responding to drags when the primary pane has been collapsed to zero', async () => {
      const onResizing = jest.fn();

      render(<TestSplitter direction="row" primaryWidth={0} containerWidth={1000} onResizing={onResizing} />);

      await dragSplitterBy(200);

      expect(onResizing).toHaveBeenCalled();
    });

    // `onSizeChanged` reports the primary pane as a 0-1 fraction in this mode, so the drag must too.
    it('reports a fraction, not pixels, while dragging a primary-pixel splitter', async () => {
      const onResizing = jest.fn();

      render(
        <TestSplitter
          direction="row"
          usePixels
          pixelPane="primary"
          initialSize={300}
          primaryWidth={300}
          containerWidth={1016}
          onResizing={onResizing}
        />
      );

      await dragSplitterBy(50);

      // The stubbed pane measures 300 at both its min and max, so the drag clamps there.
      expect(onResizing).toHaveBeenLastCalledWith(0.3, 300, 700);
    });

    it('responds to drags at a normal size', async () => {
      const onResizing = jest.fn();

      render(<TestSplitter direction="row" primaryWidth={400} containerWidth={1000} onResizing={onResizing} />);

      await dragSplitterBy(50);

      expect(onResizing).toHaveBeenCalled();
    });
  });
});
