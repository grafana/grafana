import { type RefObject } from 'react';

import { copyTextToClipboard } from './copyToClipboard';

interface Args {
  isSecureContext: boolean;
  clipboard?: Partial<Clipboard>;
  clipboardItem?: unknown;
  execCommand?: typeof document.execCommand;
  body?: typeof document.body;
}

const originalExecCommand = document.execCommand;
const originalBody = document.body;

function setupTests({ clipboard, clipboardItem, execCommand, isSecureContext, body }: Args) {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: isSecureContext });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
  Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: clipboardItem });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand ?? originalExecCommand });
  Object.defineProperty(document, 'body', { configurable: true, value: body ?? originalBody });
}

describe('copyTextToClipboard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(window, 'isSecureContext');
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(globalThis, 'ClipboardItem');

    Object.defineProperty(document, 'execCommand', { configurable: true, value: originalExecCommand });
    Object.defineProperty(document, 'body', { configurable: true, value: originalBody });
  });

  it('should use the fallback when the Clipboard API is unavailable', async () => {
    const execCommand = jest.fn().mockReturnValue(true);
    setupTests({ isSecureContext: false, execCommand });

    await copyTextToClipboard('copy me');

    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('should append to ref when ref is set and the Clipboard API is unavailable', async () => {
    const execCommand = jest.fn().mockReturnValue(true);
    const appendChild = jest.fn();
    const ref = { current: { appendChild } } as unknown as RefObject<HTMLElement>;
    setupTests({ isSecureContext: false, execCommand });

    await copyTextToClipboard('copy me', ref);

    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledWith(expect.any(Object));
  });

  it('should append to document.body when no ref is set and the Clipboard API is unavailable', async () => {
    const execCommand = jest.fn().mockReturnValue(true);
    const appendChild = jest.fn();
    const body = { appendChild } as unknown as HTMLElement;
    setupTests({ isSecureContext: false, execCommand, body });

    await copyTextToClipboard('copy me');

    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledWith(expect.any(Object));
  });

  it('should focus previously focused element when the Clipboard API is unavailable', async () => {
    const execCommand = jest.fn().mockReturnValue(true);
    const element = document.createElement('div');
    element.focus = jest.fn();
    jest.spyOn(document, 'activeElement', 'get').mockReturnValue(element);

    setupTests({ isSecureContext: false, execCommand });

    await copyTextToClipboard('copy me');

    expect(element.focus).toHaveBeenCalled();
  });

  it('should use writeText when ClipboardItem is unavailable', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setupTests({ isSecureContext: true, clipboard: { writeText } });

    await copyTextToClipboard('copy me');

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('copy me');
  });

  it('should use ClipboardItem and write when supported', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const clipboardItem = jest.fn().mockImplementation((data) => ({ data }));
    setupTests({ isSecureContext: true, clipboard: { write }, clipboardItem });

    await copyTextToClipboard('copy me');

    expect(clipboardItem).toHaveBeenCalledTimes(1);
    expect(clipboardItem).toHaveBeenCalledWith({ 'text/plain': expect.any(Promise) });
    expect(await clipboardItem.mock.calls[0][0]['text/plain']).toBe('copy me');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith([expect.any(Object)]);
  });

  it('should issue the write while the text is still pending', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const clipboardItem = jest.fn().mockImplementation((data) => ({ data }));
    setupTests({ isSecureContext: true, clipboard: { write }, clipboardItem });

    let resolveText: (value: string) => void = () => {};
    const text = new Promise<string>((resolve) => {
      resolveText = resolve;
    });

    const copied = copyTextToClipboard(text);

    expect(write).toHaveBeenCalledTimes(1);
    // The same promise, not a resolved copy of it.
    expect(clipboardItem.mock.calls[0][0]['text/plain']).toBe(text);

    resolveText('copy me');
    await expect(copied).resolves.toBeUndefined();
  });

  it('should reject when the clipboard write is refused', async () => {
    const write = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
    const clipboardItem = jest.fn().mockImplementation((data) => ({ data }));
    setupTests({ isSecureContext: true, clipboard: { write }, clipboardItem });

    await expect(copyTextToClipboard('copy me')).rejects.toThrow('NotAllowedError');
  });

  it('should reject when the pending text fails to resolve', async () => {
    // A real clipboard rejects the write when the item's promise rejects; the stub has to be told to.
    const write = jest.fn((items) => items[0].data['text/plain']);
    const clipboardItem = jest.fn().mockImplementation((data) => ({ data }));
    setupTests({ isSecureContext: true, clipboard: { write }, clipboardItem });

    await expect(copyTextToClipboard(Promise.reject(new Error('403')))).rejects.toThrow('403');
  });

  it('should reject when writeText is refused', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
    setupTests({ isSecureContext: true, clipboard: { writeText } });

    await expect(copyTextToClipboard('copy me')).rejects.toThrow('NotAllowedError');
    expect(writeText).toHaveBeenCalledWith('copy me');
  });

  it('should reject without copying when the pending text fails to resolve outside a secure context', async () => {
    const execCommand = jest.fn().mockReturnValue(true);
    setupTests({ isSecureContext: false, execCommand });

    await expect(copyTextToClipboard(Promise.reject(new Error('403')))).rejects.toThrow('403');
    expect(execCommand).not.toHaveBeenCalled();
  });
});
