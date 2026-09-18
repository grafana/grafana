import { copyStringToClipboard } from 'app/core/utils/explore';

import { copyToClipboard } from './copyToClipboard';

jest.mock('app/core/utils/explore', () => ({ copyStringToClipboard: jest.fn() }));

const mockCopyString = jest.mocked(copyStringToClipboard);

const originalClipboard = navigator.clipboard;
const originalSecureContext = window.isSecureContext;

function setClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true, writable: true });
}

/** jsdom has no ClipboardItem, so the branch that needs one has to bring its own. */
function defineClipboardItem() {
  class FakeClipboardItem {
    constructor(public readonly items: Record<string, Promise<string> | string>) {}
  }
  Object.defineProperty(globalThis, 'ClipboardItem', { value: FakeClipboardItem, configurable: true });
  return FakeClipboardItem;
}

function removeClipboardItem() {
  Reflect.deleteProperty(globalThis, 'ClipboardItem');
}

describe('copyToClipboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(window, { isSecureContext: true });
    removeClipboardItem();
  });

  afterEach(() => {
    setClipboard(originalClipboard);
    Object.assign(window, { isSecureContext: originalSecureContext });
    removeClipboardItem();
  });

  describe('with ClipboardItem', () => {
    it('issues the write before the text resolves', async () => {
      defineClipboardItem();
      const write = jest.fn().mockResolvedValue(undefined);
      setClipboard({ write, writeText: jest.fn() });

      let resolveText: (value: string) => void = () => {};
      const text = new Promise<string>((resolve) => {
        resolveText = resolve;
      });

      const copied = copyToClipboard(text);

      // The point of the whole helper: the write is already in flight while the text is pending, so
      // it happens inside the click's user activation rather than after it.
      expect(write).toHaveBeenCalledTimes(1);

      resolveText('# Notebook');
      await copied;
    });

    it('hands the pending promise to ClipboardItem rather than an awaited string', async () => {
      const FakeClipboardItem = defineClipboardItem();
      const write = jest.fn().mockResolvedValue(undefined);
      setClipboard({ write, writeText: jest.fn() });

      await copyToClipboard(Promise.resolve('# Notebook'));

      const [items] = write.mock.calls[0];
      expect(items[0]).toBeInstanceOf(FakeClipboardItem);
      await expect(items[0].items['text/plain']).resolves.toBe('# Notebook');
    });

    it('rejects when the write is refused', async () => {
      defineClipboardItem();
      setClipboard({ write: jest.fn().mockRejectedValue(new Error('NotAllowedError')), writeText: jest.fn() });

      await expect(copyToClipboard(Promise.resolve('# Notebook'))).rejects.toThrow('NotAllowedError');
    });

    it('rejects when the text itself fails to resolve', async () => {
      defineClipboardItem();
      // A real clipboard rejects the write when its promise rejects; the stub has to be told to.
      setClipboard({
        write: jest.fn((items) => items[0].items['text/plain']),
        writeText: jest.fn(),
      });

      await expect(copyToClipboard(Promise.reject(new Error('403')))).rejects.toThrow('403');
    });
  });

  describe('without ClipboardItem', () => {
    it('awaits writeText so a rejection is not swallowed', async () => {
      const writeText = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
      setClipboard({ writeText });

      await expect(copyToClipboard(Promise.resolve('# Notebook'))).rejects.toThrow('NotAllowedError');
      expect(writeText).toHaveBeenCalledWith('# Notebook');
    });

    it('resolves when writeText succeeds', async () => {
      setClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });

      await expect(copyToClipboard(Promise.resolve('# Notebook'))).resolves.toBeUndefined();
    });
  });

  describe('outside a secure context', () => {
    it('falls back to the shared helper, which uses document.execCommand', async () => {
      Object.assign(window, { isSecureContext: false });
      setClipboard(undefined);

      await copyToClipboard(Promise.resolve('# Notebook'));

      expect(mockCopyString).toHaveBeenCalledWith('# Notebook');
    });

    it('still rejects when the text fails to resolve', async () => {
      Object.assign(window, { isSecureContext: false });
      setClipboard(undefined);

      await expect(copyToClipboard(Promise.reject(new Error('403')))).rejects.toThrow('403');
      expect(mockCopyString).not.toHaveBeenCalled();
    });
  });
});
