import { act, renderHook } from '@testing-library/react';

import { usePreviewContent } from './usePreviewContent';

describe('usePreviewContent', () => {
  it('drops content that resolves after the preview was dismissed mid-load', async () => {
    let resolveLoad!: (content: string) => void;
    const { result } = renderHook(() => usePreviewContent(''));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.show(() => new Promise<string>((resolve) => (resolveLoad = resolve)), String);
    });
    act(() => result.current.hide());
    await act(async () => {
      resolveLoad('secret-bearing content');
      await pending;
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.content).toBe('');
  });

  it('clears loaded content when hidden', async () => {
    const { result } = renderHook(() => usePreviewContent(''));

    await act(() => result.current.show(async () => 'loaded', String));
    expect(result.current.content).toBe('loaded');

    act(() => result.current.hide());
    expect(result.current.content).toBe('');
  });

  it('shows the formatted error when loading fails', async () => {
    const { result } = renderHook(() => usePreviewContent(''));

    await act(() =>
      result.current.show(
        async () => {
          throw new Error('boom');
        },
        (err) => `failed: ${(err as Error).message}`
      )
    );

    expect(result.current.content).toBe('failed: boom');
  });
});
