import { act, render, screen } from '@testing-library/react';

import { createAsyncSingletonLoader } from './createAsyncSingletonLoader';
import { useAsyncReady } from './useAsyncReady';

function ReadyProbe({ loader }: { loader: ReturnType<typeof createAsyncSingletonLoader<void>> }) {
  const ready = useAsyncReady(loader);
  return <div>{ready ? 'ready' : 'waiting'}</div>;
}

function ReadyProbeWithArgs({
  loader,
  args,
}: {
  loader: ReturnType<typeof createAsyncSingletonLoader<string, string>>;
  args: string;
}) {
  const ready = useAsyncReady(loader, args);
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

  it('forwards Args to the loader on first call only', async () => {
    const fetcher = jest.fn(
      (label: string) =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve(`result:${label}`), 2000);
        })
    );
    const loader = createAsyncSingletonLoader<string, string>(fetcher);

    const firstRender = render(<ReadyProbeWithArgs loader={loader} args="alpha" />);
    expect(screen.getByText('waiting')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('alpha');

    firstRender.unmount();
    // A second consumer mounting with a different `args` still sees ready
    // synchronously: the singleton cached the first call's promise.
    render(<ReadyProbeWithArgs loader={loader} args="beta" />);
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
