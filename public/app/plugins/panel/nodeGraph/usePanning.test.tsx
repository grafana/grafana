import { act, render } from '@testing-library/react';

import { type State, usePanning } from './usePanning';

// NodeGraph always passes the bounds of its content.
const bounds = { top: -1000, right: 1000, bottom: 1000, left: -1000, center: { x: 0, y: 0 } };

function Pannable({ onState }: { onState: (state: State) => void }) {
  const { state, ref } = usePanning<HTMLDivElement>({ bounds });
  onState(state);
  return <div data-testid="pannable" ref={ref} />;
}

describe('usePanning', () => {
  beforeEach(() => {
    // pans are applied in an animation frame
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // A Document Picture-in-Picture window (the Grafana Assistant pop-out) is another realm, as an iframe is: the mouse
  // events of a drag there are that window's, and only its document sees the moves and the release.
  it('pans with a drag in another window', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const otherWindow = iframe.contentDocument!.defaultView!;
    const container = otherWindow.document.body.appendChild(otherWindow.document.createElement('div'));
    const states: State[] = [];
    const { getByTestId, unmount } = render(<Pannable onState={(state) => states.push(state)} />, { container });

    act(() => {
      getByTestId('pannable').dispatchEvent(new otherWindow.MouseEvent('mousedown', { clientX: 10, clientY: 10 }));
    });
    act(() => {
      otherWindow.document.dispatchEvent(new otherWindow.MouseEvent('mousemove', { clientX: 40, clientY: 30 }));
      jest.runOnlyPendingTimers();
    });

    expect(states.at(-1)).toEqual({ isPanning: true, position: { x: 30, y: 20 } });

    act(() => {
      otherWindow.document.dispatchEvent(new otherWindow.MouseEvent('mouseup', { clientX: 40, clientY: 30 }));
    });

    expect(states.at(-1)?.isPanning).toBe(false);
    // Unmount before the iframe goes, or React cannot remove the element from it.
    unmount();
    iframe.remove();
  });
});
