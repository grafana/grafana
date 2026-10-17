import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { POPOVER_DEFAULT_SIZE, ScopesSelectorPopover, resetStoredSize } from './ScopesSelectorPopover';

type ResizeCallback = ResizeObserverCallback;

// Floating UI observes the popover too, so every callback registered on it is notified
const popoverObservers: Array<() => void> = [];

class ResizeObserverStub {
  constructor(private callback: ResizeCallback) {}
  observe(element: Element) {
    if (element.getAttribute('data-testid') === 'scopes-selector-popover') {
      popoverObservers.push(() =>
        this.callback([{ target: element } as ResizeObserverEntry], this as unknown as ResizeObserver)
      );
    }
  }
  unobserve() {}
  disconnect() {}
}

async function setup(onClose = jest.fn()) {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const utils = render(
    <ScopesSelectorPopover anchor={anchor} title="Select scopes" onClose={onClose}>
      <div>content</div>
    </ScopesSelectorPopover>
  );
  // Floating UI computes the position asynchronously
  await act(async () => {});
  return { ...utils, onClose };
}

describe('ScopesSelectorPopover', () => {
  beforeEach(() => {
    window.ResizeObserver = ResizeObserverStub;
    resetStoredSize();
    popoverObservers.length = 0;
  });

  it('opens at the default size', async () => {
    await setup();
    const popover = screen.getByTestId('scopes-selector-popover');
    expect(popover).toHaveStyle({
      width: `${POPOVER_DEFAULT_SIZE.width}px`,
      height: `${POPOVER_DEFAULT_SIZE.height}px`,
    });
  });

  it('reopens at the size it was last resized to during the session', async () => {
    const width = jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(640);
    const height = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(360);
    const first = await setup();
    act(() => popoverObservers.forEach((notify) => notify()));
    first.unmount();
    width.mockRestore();
    height.mockRestore();

    await setup();
    expect(screen.getByTestId('scopes-selector-popover')).toHaveStyle({ width: '640px', height: '360px' });
  });

  it('closes on Escape', async () => {
    const { onClose } = await setup();
    // Focus is moved into the popover asynchronously, so the first Escape can land before it is listening
    await waitFor(async () => {
      await userEvent.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('closes on a click outside of it', async () => {
    const { onClose } = await setup();
    await userEvent.click(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});
