import { offsetsToRange } from './editorRange';

describe('offsetsToRange', () => {
  it('maps single-line offsets to a 1-based range', () => {
    const text = 'rate(metric[5m])';
    // "metric" starts at offset 5, ends at 11.
    expect(offsetsToRange(text, 5, 11)).toEqual({
      startLineNumber: 1,
      startColumn: 6,
      endLineNumber: 1,
      endColumn: 12,
    });
  });

  it('maps offsets that span multiple lines', () => {
    const text = 'sum(\n  rate(metric[5m])\n)';
    const from = text.indexOf('rate'); // start on line 2
    const to = text.indexOf('m])') + 2; // still line 2
    const range = offsetsToRange(text, from, to);
    expect(range.startLineNumber).toBe(2);
    expect(range.startColumn).toBe(3);
    expect(range.endLineNumber).toBe(2);
  });

  it('normalizes reversed offsets', () => {
    const text = 'metric';
    expect(offsetsToRange(text, 4, 1)).toEqual({
      startLineNumber: 1,
      startColumn: 2,
      endLineNumber: 1,
      endColumn: 5,
    });
  });

  it('clamps offsets to the text bounds', () => {
    const text = 'up';
    expect(offsetsToRange(text, -5, 99)).toEqual({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 3,
    });
  });

  it('counts columns correctly across a CRLF (\\r\\n) line break', () => {
    const text = 'rate(a)\r\nrate(b)';
    const from = text.indexOf('rate(b)');
    const to = from + 'rate(b)'.length;
    expect(offsetsToRange(text, from, to)).toEqual({
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 2,
      endColumn: 8,
    });
  });

  it('handles a zero-width span (from === to) without throwing', () => {
    const text = 'metric';
    expect(offsetsToRange(text, 3, 3)).toEqual({
      startLineNumber: 1,
      startColumn: 4,
      endLineNumber: 1,
      endColumn: 4,
    });
  });

  it('handles an empty string', () => {
    expect(offsetsToRange('', 0, 0)).toEqual({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
    });
  });

  it('handles an offset exactly at the end of the text', () => {
    const text = 'up';
    expect(offsetsToRange(text, 0, text.length)).toEqual({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 3,
    });
  });
});
