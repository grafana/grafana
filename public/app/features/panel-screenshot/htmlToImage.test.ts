import { captureWithHtmlToImage, renderToCanvas } from './htmlToImage';

const toBlobMock = jest.fn();
const toCanvasMock = jest.fn();
jest.mock(
  'html-to-image',
  () => ({
    toBlob: (...args: unknown[]) => toBlobMock(...args),
    toCanvas: (...args: unknown[]) => toCanvasMock(...args),
  }),
  { virtual: true }
);

function crossOriginSheetError() {
  return new DOMException("Failed to read the 'cssRules' property from 'CSSStyleSheet'", 'SecurityError');
}

describe('htmlToImage console output', () => {
  let consoleError: jest.SpyInstance;
  const element = document.createElement('div');

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    toBlobMock.mockReset();
    toCanvasMock.mockReset();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('drops the unreadable-stylesheet report while rendering a canvas', async () => {
    toCanvasMock.mockImplementation(async () => {
      console.error('Error while reading CSS rules from https://cdn.example/app.css', crossOriginSheetError());
      return document.createElement('canvas');
    });

    await renderToCanvas(element);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('drops the report while capturing a blob', async () => {
    toBlobMock.mockImplementation(async () => {
      console.error('Error while reading CSS rules from https://cdn.example/app.css', crossOriginSheetError());
      return new Blob(['x']);
    });

    await captureWithHtmlToImage(element, 'png');

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps other errors logged during a capture', async () => {
    const other = new Error('boom');
    toCanvasMock.mockImplementation(async () => {
      console.error('Error loading remote css', 'x');
      console.error('Error while reading CSS rules from https://cdn.example/app.css', other);
      return document.createElement('canvas');
    });

    await renderToCanvas(element);

    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith('Error loading remote css', 'x');
    expect(consoleError).toHaveBeenCalledWith('Error while reading CSS rules from https://cdn.example/app.css', other);
  });

  it('restores console.error after a capture, including a failed one', async () => {
    const installed = console.error;
    toCanvasMock.mockRejectedValueOnce(new Error('render failed'));

    await expect(renderToCanvas(element)).rejects.toThrow('render failed');

    expect(console.error).toBe(installed);
  });

  it('keeps the filter until the last of two overlapping captures finishes', async () => {
    const installed = console.error;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    toCanvasMock.mockImplementation(async () => {
      await gate;
      console.error('Error while reading CSS rules from https://cdn.example/app.css', crossOriginSheetError());
      return document.createElement('canvas');
    });

    const first = renderToCanvas(element);
    const second = renderToCanvas(element);
    release();
    await Promise.all([first, second]);

    expect(consoleError).not.toHaveBeenCalled();
    expect(console.error).toBe(installed);
  });
});
