import { renderHook } from '@testing-library/react';

import { useCopyToClipboard } from './useCopyToClipboard';

const originalIsSecureContext = window.isSecureContext;
const originalClipboard = navigator.clipboard;

afterEach(() => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: originalIsSecureContext });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
  jest.restoreAllMocks();
});

it('writes to the modern Clipboard API when available in a secure context', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

  const { result } = renderHook(() => useCopyToClipboard());
  await result.current('hello');

  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith('hello');
});

it('falls back to a textarea + execCommand when the secure-context API is unavailable', async () => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });

  // jsdom doesn't implement document.execCommand, so attach a stub before spying.
  const execCommand = jest.fn().mockReturnValue(true);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

  const initialTextareaCount = document.body.querySelectorAll('textarea').length;

  const { result } = renderHook(() => useCopyToClipboard());
  await result.current('hello');

  expect(execCommand).toHaveBeenCalledWith('copy');
  // The fallback textarea is appended to document.body and removed before the function returns.
  expect(document.body.querySelectorAll('textarea').length).toBe(initialTextareaCount);
});

it('returns a stable callback across renders', () => {
  const { result, rerender } = renderHook(() => useCopyToClipboard());
  const first = result.current;
  rerender();
  expect(result.current).toBe(first);
});

it('appends the fallback textarea to the provided ref element when given', async () => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: jest.fn().mockReturnValue(true),
  });

  const container = document.createElement('div');
  document.body.appendChild(container);
  const ref = { current: container };
  const appendSpy = jest.spyOn(container, 'appendChild');

  const { result } = renderHook(() => useCopyToClipboard(ref));
  await result.current('hello');

  expect(appendSpy).toHaveBeenCalledTimes(1);
  expect(appendSpy.mock.calls[0][0]).toBeInstanceOf(HTMLTextAreaElement);
  // Cleanup: ref-targeted textarea is also removed before the function returns.
  expect(container.querySelectorAll('textarea').length).toBe(0);

  container.remove();
});
