import { renderHook } from '@testing-library/react';
import { type RefObject } from 'react';

import { copyTextToClipboard } from '../utils/copyToClipboard';

import { useCopyToClipboard } from './useCopyToClipboard';

jest.mock('../utils/copyToClipboard');

describe('useCopyToClipboard', () => {
  beforeEach(() => jest.resetAllMocks());

  it('should delegate to copyTextToClipboard with the text and appendTo ref', async () => {
    const appendTo = { current: document.createElement('div') };
    const { result } = renderHook(() => useCopyToClipboard(appendTo));

    await result.current('hello');

    expect(copyTextToClipboard).toHaveBeenCalledWith('hello', appendTo);
  });

  it('should return a stable callback across re-renders when appendTo is unchanged', () => {
    const appendTo = { current: null };
    const { result, rerender } = renderHook(({ ref }) => useCopyToClipboard(ref), {
      initialProps: { ref: appendTo },
    });
    const first = result.current;

    rerender({ ref: appendTo });

    expect(result.current).toBe(first);
  });

  it('should return a new callback when appendTo changes', () => {
    const appendTo: RefObject<HTMLElement | null> = { current: null };
    const { result, rerender } = renderHook(({ ref }) => useCopyToClipboard(ref), {
      initialProps: { ref: appendTo },
    });
    const first = result.current;

    rerender({ ref: { current: document.createElement('div') } });

    expect(result.current).not.toBe(first);
  });

  it('should propagate rejections from copyTextToClipboard', async () => {
    jest.mocked(copyTextToClipboard).mockRejectedValueOnce(new Error('nope'));

    const { result } = renderHook(() => useCopyToClipboard());

    await expect(result.current('hello')).rejects.toThrow('nope');
  });
});
