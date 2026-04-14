import { render, screen } from '@testing-library/react';
import React, { Suspense } from 'react';

import { lazyWithChunkRetry } from './lazyWithChunkRetry';

describe('lazyWithChunkRetry', () => {
  let reloadMock: jest.Mock;

  beforeEach(() => {
    sessionStorage.clear();
    reloadMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });
  });

  it('renders component on successful load', async () => {
    const TestComp = () => React.createElement('div', null, 'loaded');
    const Lazy = lazyWithChunkRetry(() => Promise.resolve({ default: TestComp }));

    render(
      React.createElement(
        Suspense,
        { fallback: React.createElement('div', null, 'loading') },
        React.createElement(Lazy)
      )
    );

    expect(await screen.findByText('loaded')).toBeInTheDocument();
  });

  it('clears reload flag after successful load', async () => {
    sessionStorage.setItem('grafana-chunk-reload', 'true');
    const TestComp = () => React.createElement('div', null, 'loaded');
    const Lazy = lazyWithChunkRetry(() => Promise.resolve({ default: TestComp }));

    render(
      React.createElement(
        Suspense,
        { fallback: React.createElement('div', null, 'loading') },
        React.createElement(Lazy)
      )
    );

    expect(await screen.findByText('loaded')).toBeInTheDocument();
    expect(sessionStorage.getItem('grafana-chunk-reload')).toBeNull();
  });

  it('reloads page on ChunkLoadError', async () => {
    const error = new Error('Loading chunk 578 failed');
    error.name = 'ChunkLoadError';

    // Spy on React.lazy to capture the wrapped factory
    const lazySpy = jest.spyOn(React, 'lazy');
    lazyWithChunkRetry(() => Promise.reject(error));

    const wrappedFactory = lazySpy.mock.calls[0][0];
    // The factory returns a never-resolving promise after triggering reload
    wrappedFactory();

    // Wait for the microtask (catch handler) to execute
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('grafana-chunk-reload')).toBe('true');
    lazySpy.mockRestore();
  });

  it('does not reload if already reloaded in this session', async () => {
    sessionStorage.setItem('grafana-chunk-reload', 'true');
    const error = new Error('Loading chunk 578 failed');
    error.name = 'ChunkLoadError';

    const lazySpy = jest.spyOn(React, 'lazy');
    lazyWithChunkRetry(() => Promise.reject(error));

    const wrappedFactory = lazySpy.mock.calls[0][0];

    await expect(wrappedFactory()).rejects.toThrow('Loading chunk 578 failed');
    expect(reloadMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('grafana-chunk-reload')).toBeNull();
    lazySpy.mockRestore();
  });

  it('rethrows non-ChunkLoadError errors', async () => {
    const error = new Error('Network error');

    const lazySpy = jest.spyOn(React, 'lazy');
    lazyWithChunkRetry(() => Promise.reject(error));

    const wrappedFactory = lazySpy.mock.calls[0][0];

    await expect(wrappedFactory()).rejects.toThrow('Network error');
    expect(reloadMock).not.toHaveBeenCalled();
    lazySpy.mockRestore();
  });
});
