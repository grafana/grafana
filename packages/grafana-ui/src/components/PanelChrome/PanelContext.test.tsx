import { act, render, screen } from '@testing-library/react';

import {
  PanelContextProvider,
  type PanelContext,
  type PanelInlineEditChannel,
  usePanelCanEditInline,
} from './PanelContext';

function createChannel(initial = false) {
  let canEdit = initial;
  const listeners = new Set<() => void>();
  const unsubscribe = jest.fn();

  const channel: PanelInlineEditChannel = {
    getState: () => canEdit,
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
        unsubscribe();
      };
    },
  };

  return {
    channel,
    unsubscribe,
    set(next: boolean) {
      canEdit = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

function Probe({ enabled }: { enabled?: boolean }) {
  return <div data-testid="probe">{String(usePanelCanEditInline(enabled))}</div>;
}

function renderProbe(inlineEdit?: PanelInlineEditChannel, enabled?: boolean) {
  return render(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    <PanelContextProvider value={{ inlineEdit } as PanelContext}>
      <Probe enabled={enabled} />
    </PanelContextProvider>
  );
}

describe('usePanelCanEditInline', () => {
  it('is false when the host provides no channel', () => {
    renderProbe();

    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });

  it('reads the current value from the channel', () => {
    renderProbe(createChannel(true).channel);

    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });

  it('re-renders when the channel notifies of a change', () => {
    const { channel, set } = createChannel();

    renderProbe(channel);
    expect(screen.getByTestId('probe')).toHaveTextContent('false');

    set(true);

    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });

  it('does not subscribe at all when disabled', () => {
    const { channel } = createChannel(true);
    const subscribe = jest.spyOn(channel, 'subscribe');

    renderProbe(channel, false);

    expect(screen.getByTestId('probe')).toHaveTextContent('false');
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes from the channel on unmount', () => {
    const { channel, unsubscribe } = createChannel();

    const { unmount } = renderProbe(channel);
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
