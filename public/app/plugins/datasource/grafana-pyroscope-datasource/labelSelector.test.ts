import { formatLabelName, lex, parseSelector } from './labelSelector';

describe('lex', () => {
  it('tokenises a simple selector', () => {
    const tokens = lex('{service="web"}');
    expect(tokens).toEqual([
      { kind: 'lbrace', value: '{' },
      { kind: 'name', value: 'service' },
      { kind: 'op', value: '=' },
      { kind: 'quoted', value: 'web' },
      { kind: 'rbrace', value: '}' },
    ]);
  });

  it('handles escaped quotes and backslashes in quoted strings', () => {
    const tokens = lex(String.raw`{"has\"quote"="val"}`);
    expect(tokens).toEqual([
      { kind: 'lbrace', value: '{' },
      { kind: 'quoted', value: 'has"quote' },
      { kind: 'op', value: '=' },
      { kind: 'quoted', value: 'val' },
      { kind: 'rbrace', value: '}' },
    ]);
  });

  it('handles escaped backslash in quoted strings', () => {
    const tokens = lex(String.raw`{"has\\backslash"="val"}`);
    expect(tokens).toEqual([
      { kind: 'lbrace', value: '{' },
      { kind: 'quoted', value: 'has\\backslash' },
      { kind: 'op', value: '=' },
      { kind: 'quoted', value: 'val' },
      { kind: 'rbrace', value: '}' },
    ]);
  });

  it('handles both escaped quotes and backslashes', () => {
    const tokens = lex(String.raw`{"both\"and\\"="val"}`);
    expect(tokens).toEqual([
      { kind: 'lbrace', value: '{' },
      { kind: 'quoted', value: 'both"and\\' },
      { kind: 'op', value: '=' },
      { kind: 'quoted', value: 'val' },
      { kind: 'rbrace', value: '}' },
    ]);
  });
});

describe('parseSelector', () => {
  it('parses a selector with a quoted label name containing escaped characters', () => {
    const result = parseSelector(String.raw`{"has\"quote"="value"}`);
    expect(result).toEqual([{ name: 'has"quote', operator: '=', value: 'value' }]);
  });

  it('parses a selector with a label name containing escaped backslash', () => {
    const result = parseSelector(String.raw`{"has\\backslash"="value"}`);
    expect(result).toEqual([{ name: 'has\\backslash', operator: '=', value: 'value' }]);
  });
});

describe('formatLabelName', () => {
  it('returns safe names unchanged', () => {
    expect(formatLabelName('service')).toBe('service');
    expect(formatLabelName('_private')).toBe('_private');
    expect(formatLabelName('__name__')).toBe('__name__');
  });

  it('quotes names with dots', () => {
    expect(formatLabelName('k8s.namespace')).toBe('"k8s.namespace"');
  });

  it('quotes names with hyphens', () => {
    expect(formatLabelName('some-label')).toBe('"some-label"');
  });

  it('escapes double quotes in label names', () => {
    expect(formatLabelName('has"quote')).toBe('"has\\"quote"');
  });

  it('escapes backslashes in label names', () => {
    expect(formatLabelName('has\\backslash')).toBe('"has\\\\backslash"');
  });

  it('escapes both double quotes and backslashes', () => {
    expect(formatLabelName('both"and\\')).toBe('"both\\"and\\\\"');
  });

  it('round-trips through lex for names with special characters', () => {
    const names = ['has"quote', 'has\\backslash', 'both"and\\'];
    for (const name of names) {
      const formatted = formatLabelName(name);
      const tokens = lex(formatted);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe('quoted');
      expect(tokens[0].value).toBe(name);
    }
  });
});
