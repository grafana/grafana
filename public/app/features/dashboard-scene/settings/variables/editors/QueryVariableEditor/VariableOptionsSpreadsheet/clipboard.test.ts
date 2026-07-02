import { parseClipboardText } from './clipboard';

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

    test('detects header row when all first-line columns match properties exactly', async () => {
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
    test('parses comma-separated label:value pairs via CustomVariable', async () => {
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

    test('returns empty array when text starts with [ but is invalid JSON', async () => {
      const text = '[{broken';

      const result = await parseClipboardText(text, ['value', 'text']);

      expect(result).toEqual([]);
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
