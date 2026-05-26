import { act, render, screen } from '@testing-library/react';

import { createAsyncSingletonLoader } from './createAsyncSingletonLoader';
import { useAsyncReady } from './useAsyncReady';

function ReadyProbe({ loader }: { loader: ReturnType<typeof createAsyncSingletonLoader<void>> }) {
  const ready = useAsyncReady(loader);
  return <div>{ready ? 'ready' : 'waiting'}</div>;
}

describe('useAsyncReady', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for async load, then is synchronous on second mount', async () => {
    const loader = createAsyncSingletonLoader(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 2000);
        })
    );

    const firstRender = render(<ReadyProbe loader={loader} />);
    expect(screen.getByText('waiting')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(screen.getByText('ready')).toBeInTheDocument();

    firstRender.unmount();
    render(<ReadyProbe loader={loader} />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
