import { act, renderHook, waitFor } from '@testing-library/react';

import { parseClipboardText, useClipboardPaste } from './clipboard';

describe('parseClipboardText', () => {
  describe('unrecognized format', () => {
    test('returns empty array for plain text without tabs, commas, or JSON structure', async () => {
      const text = 'hello world';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toEqual([]);
    });
  });

  describe('TSV format', () => {
    test('parses tab-separated rows using properties as column headers', async () => {
      const text = 'val1\tLabel 1\nval2\tLabel 2';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { value: 'val1', label: 'Label 1', properties: { value: 'val1', text: 'Label 1' } },
        { value: 'val2', label: 'Label 2', properties: { value: 'val2', text: 'Label 2' } },
      ]);
    });

    test('detects header row when every first-line column is a known property name', async () => {
      const text = 'value\ttext\nval1\tLabel 1';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { value: 'val1', label: 'Label 1', properties: { value: 'val1', text: 'Label 1' } },
      ]);
    });

    test('treats first line as data when columns do not all match properties', async () => {
      const text = 'foo\tbar\nval1\tLabel 1';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { value: 'foo', label: 'bar', properties: { value: 'foo', text: 'bar' } },
        { value: 'val1', label: 'Label 1', properties: { value: 'val1', text: 'Label 1' } },
      ]);
    });

    test('fills missing columns with empty strings when row has fewer cells than properties', async () => {
      const text = 'val1\tLabel 1';

      const result = await parseClipboardText(text, ['value', 'text', 'region']);

      expect(result).toStrictEqual([
        { value: 'val1', label: 'Label 1', properties: { value: 'val1', text: 'Label 1', region: '' } },
      ]);
    });

    test('skips empty and whitespace-only lines', async () => {
      const text = 'val1\tL1\n\n   \nval2\tL2\n';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { value: 'val1', label: 'L1', properties: { value: 'val1', text: 'L1' } },
        { value: 'val2', label: 'L2', properties: { value: 'val2', text: 'L2' } },
      ]);
    });

    test('trims whitespace from cell values', async () => {
      const text = '  val1  \t  Label 1  ';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { value: 'val1', label: 'Label 1', properties: { value: 'val1', text: 'Label 1' } },
      ]);
    });

    test('returns empty array for whitespace-only input containing a tab', async () => {
      const text = '  \t  \n  \t  ';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toEqual([]);
    });

    test('uses props.text as label and props.value as value', async () => {
      const text = 'value\ttext\nmy-val\tMy Label';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { value: 'my-val', label: 'My Label', properties: { value: 'my-val', text: 'My Label' } },
      ]);
    });

    test('falls back to props.value for label when text property is missing', async () => {
      const text = 'my-val\t';

      const result = await parseClipboardText(text, ['value']);

      expect(result).toStrictEqual([{ value: 'my-val', label: 'my-val', properties: { value: 'my-val' } }]);
    });
  });

  describe('CSV format', () => {
    test('parses comma-separated label:value pairs', async () => {
      const text = 'Label 1 : val1, Label 2 : val2';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { label: 'Label 1', value: 'val1' },
        { label: 'Label 2', value: 'val2' },
      ]);
    });

    test('parses simple comma-separated values without labels', async () => {
      const text = 'a,b,c';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { label: 'a', value: 'a' },
        { label: 'b', value: 'b' },
        { label: 'c', value: 'c' },
      ]);
    });
  });

  describe('JSON format', () => {
    test('parses a valid JSON array of objects', async () => {
      const text = '[{"value":"v1","text":"L1"},{"value":"v2","text":"L2"}]';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { label: 'L1', value: 'v1', properties: { value: 'v1', text: 'L1' } },
        { label: 'L2', value: 'v2', properties: { value: 'v2', text: 'L2' } },
      ]);
    });

    test('returns empty array when text starts with [ but is invalid JSON and contains no commas', async () => {
      const text = '[{broken';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toEqual([]);
    });

    test('falls back to CSV parsing when text starts with [ but is invalid JSON and contains commas', async () => {
      const text = '[{"a":1},{"b"';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([
        { label: '[{"a":1}', value: '[{"a":1}' },
        { label: '{"b"', value: '{"b"' },
      ]);
    });
  });

  describe('format precedence', () => {
    test('prefers TSV when text contains both tabs and commas', async () => {
      const text = 'a,b\tc';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toStrictEqual([{ value: 'a,b', label: 'c', properties: { value: 'a,b', text: 'c' } }]);
    });
  });
});

describe('useClipboardPaste', () => {
  describe('when the Permissions API does not support clipboard-read (Firefox, Safari)', () => {
    test('stays in gesture-only mode with the paste button enabled and never probes the clipboard', async () => {
      const { readText } = mockClipboardContent('a,b,c');
      mockPermissionsWithoutClipboardRead();

      const { result } = renderHook(() => useClipboardPaste());
      await act(async () => {}); // wait for the permission check to finish, otherwise we would assert before the hook had a chance to react

      expect(result.current.access).toBe('gesture-only');
      expect(result.current.canPaste).toBe(true);
      expect(result.current.clipboardFormat).toBeUndefined();
      expect(readText).not.toHaveBeenCalled();
    });
  });

  describe('when the Permissions API is not available at all', () => {
    test('stays in gesture-only mode with the paste button enabled', async () => {
      const { readText } = mockClipboardContent('a,b,c');
      mockMissingPermissionsApi();

      const { result } = renderHook(() => useClipboardPaste());
      await act(async () => {}); // wait for the permission check to finish, otherwise we would assert before the hook had a chance to react

      expect(result.current.access).toBe('gesture-only');
      expect(result.current.canPaste).toBe(true);
      expect(readText).not.toHaveBeenCalled();
    });
  });

  describe('when permission was already denied', () => {
    test('disables the paste button without reading the clipboard', async () => {
      const { readText } = mockClipboardContent('a,b,c');
      mockPermissionState('denied');

      const { result } = renderHook(() => useClipboardPaste());
      await waitFor(() => expect(result.current.access).toBe('denied'));

      expect(result.current.canPaste).toBe(false);
      expect(readText).not.toHaveBeenCalled();
    });
  });

  describe('when permission is not granted yet (prompt)', () => {
    test('enables the paste button without reading the clipboard', async () => {
      const { readText } = mockClipboardContent('a,b,c');
      mockPermissionState('prompt');

      const { result } = renderHook(() => useClipboardPaste());
      await waitFor(() => expect(result.current.access).toBe('prompt'));

      expect(result.current.canPaste).toBe(true);
      expect(readText).not.toHaveBeenCalled();
    });

    describe('when the user dismisses the permission prompt during a paste attempt', () => {
      test('stays in prompt mode so the next click can re-prompt', async () => {
        mockClipboardReadError(new Error('Read permission denied.'));
        mockPermissionState('prompt');

        const { result } = renderHook(() => useClipboardPaste());
        await waitFor(() => expect(result.current.access).toBe('prompt'));
        await act(async () => {
          expect(await result.current.readClipboard()).toBe(null);
        });

        expect(result.current.access).toBe('prompt');
        expect(result.current.canPaste).toBe(true);
      });
    });

    describe('when the user blocks the permission prompt', () => {
      test('switches to denied via the permission change event', async () => {
        mockClipboardReadError(new Error('Read permission denied.'));
        const permissionStatus = mockPermissionState('prompt');

        const { result } = renderHook(() => useClipboardPaste());
        await waitFor(() => expect(result.current.access).toBe('prompt'));
        act(() => {
          // blocking fires the PermissionStatus 'change' event with the new state
          permissionStatus.state = 'denied';
          const onChange = permissionStatus.addEventListener.mock.calls[0][1];
          onChange();
        });

        expect(result.current.access).toBe('denied');
        expect(result.current.canPaste).toBe(false);
      });
    });
  });

  describe('when permission is granted', () => {
    test('probes the clipboard on mount and reports the detected format', async () => {
      const { readText } = mockClipboardContent('a,b,c');
      mockPermissionState('granted');

      const { result } = renderHook(() => useClipboardPaste());
      await waitFor(() => {
        expect(result.current.access).toBe('granted');
        expect(result.current.canPaste).toBe(true);
      });

      expect(result.current.access).toBe('granted');
      expect(result.current.clipboardFormat).toBe('csv');
      expect(readText).toHaveBeenCalledTimes(1);
    });

    test('disables the paste button when the clipboard content is not parseable', async () => {
      mockClipboardContent('plain text without any delimiter');
      mockPermissionState('granted');

      const { result } = renderHook(() => useClipboardPaste());
      await waitFor(() => expect(result.current.access).toBe('granted'));

      expect(result.current.canPaste).toBe(false);
    });

    test('disables the paste button after the clipboard content has been imported', async () => {
      mockClipboardContent('a,b,c');
      mockPermissionState('granted');

      const { result } = renderHook(() => useClipboardPaste());
      await waitFor(() => {
        expect(result.current.access).toBe('granted');
        expect(result.current.canPaste).toBe(true);
      });
      act(() => {
        result.current.markImported('a,b,c');
      });

      expect(result.current.canPaste).toBe(false);
    });

    test('probes the clipboard again when the window regains focus', async () => {
      const { readText } = mockClipboardContent('a,b,c');
      mockPermissionState('granted');

      const { result } = renderHook(() => useClipboardPaste());
      await waitFor(() => expect(result.current.clipboardFormat).toBe('csv'));
      readText.mockResolvedValue('val1\tLabel 1');
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(readText).toHaveBeenCalledTimes(2);
      expect(result.current.clipboardFormat).toBe('tsv');
    });

    test('re-enables the paste button when the clipboard content changes after an import', async () => {
      const { readText } = mockClipboardContent('a,b,c');
      mockPermissionState('granted');

      const { result } = renderHook(() => useClipboardPaste());
      await waitFor(() => {
        expect(result.current.access).toBe('granted');
        expect(result.current.canPaste).toBe(true);
      });
      act(() => {
        result.current.markImported('a,b,c');
      });
      expect(result.current.canPaste).toBe(false);
      readText.mockResolvedValue('x,y,z');
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(result.current.canPaste).toBe(true);
    });
  });

  describe('clipboard preservation', () => {
    test('never writes to the clipboard, even after an import', async () => {
      const { writeText } = mockClipboardContent('a,b,c');
      mockPermissionState('granted');

      const { result } = renderHook(() => useClipboardPaste());
      await waitFor(() => {
        expect(result.current.access).toBe('granted');
        expect(result.current.canPaste).toBe(true);
      });
      act(() => {
        result.current.markImported('a,b,c');
      });

      expect(writeText).not.toHaveBeenCalled();
    });
  });
});

function installClipboardMock(readText: jest.Mock) {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { readText, writeText }, configurable: true });
  return { readText, writeText };
}

const mockClipboardContent = (content: string) => installClipboardMock(jest.fn().mockResolvedValue(content));

const mockClipboardReadError = (error: Error) => installClipboardMock(jest.fn().mockRejectedValue(error));

function mockPermissionState(state: PermissionState) {
  const permissionStatus = { state, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  Object.defineProperty(navigator, 'permissions', {
    value: { query: jest.fn().mockResolvedValue(permissionStatus) },
    configurable: true,
  });
  return permissionStatus;
}

function mockMissingPermissionsApi() {
  Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true });
}

// Firefox and Safari: the Permissions API exists but rejects 'clipboard-read' queries
function mockPermissionsWithoutClipboardRead() {
  Object.defineProperty(navigator, 'permissions', {
    value: {
      query: jest.fn().mockRejectedValue(new TypeError("'clipboard-read' is not a valid value for PermissionName")),
    },
    configurable: true,
  });
}
