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
    const ref = { current: { appendChild } } as unknown as React.RefObject<HTMLElement>;
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
});
