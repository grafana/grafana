import {
  escapeLabelValueInExactSelector,
  escapeLabelValueInRegexSelector,
  unescapeLabelValue,
} from './languageUtils';

describe('escapeLabelValueInExactSelector()', () => {
  it('handles newline characters', () => {
    expect(escapeLabelValueInExactSelector('t\nes\nt')).toBe('t\\nes\\nt');
  });

  it('handles backslash characters', () => {
    expect(escapeLabelValueInExactSelector('t\\es\\t')).toBe('t\\\\es\\\\t');
  });

  it('handles double-quote characters', () => {
    expect(escapeLabelValueInExactSelector('t"es"t')).toBe('t\\"es\\"t');
  });

  it('handles carriage return characters', () => {
    expect(escapeLabelValueInExactSelector('t\res\rt')).toBe('t\\res\\rt');
  });

  it('handles tab characters', () => {
    expect(escapeLabelValueInExactSelector('t\tes\tt')).toBe('t\\tes\\tt');
  });

  it('handles all together', () => {
    expect(escapeLabelValueInExactSelector('t\\e"st\nl\nab"e\\l')).toBe('t\\\\e\\"st\\nl\\nab\\"e\\\\l');
  });

  it('handles Windows CRLF and tab (common in Windows Event logs)', () => {
    expect(escapeLabelValueInExactSelector('line1\r\nline2\tcolumn')).toBe('line1\\r\\nline2\\tcolumn');
  });
});

describe('unescapeLabelValue()', () => {
  it('unescapes newline sequences', () => {
    expect(unescapeLabelValue('t\\nes\\nt')).toBe('t\nes\nt');
  });

  it('unescapes backslash sequences', () => {
    expect(unescapeLabelValue('t\\\\es\\\\t')).toBe('t\\es\\t');
  });

  it('unescapes double-quote sequences', () => {
    expect(unescapeLabelValue('t\\"es\\"t')).toBe('t"es"t');
  });

  it('unescapes carriage return sequences', () => {
    expect(unescapeLabelValue('t\\res\\rt')).toBe('t\res\rt');
  });

  it('unescapes tab sequences', () => {
    expect(unescapeLabelValue('t\\tes\\tt')).toBe('t\tes\tt');
  });

  it('correctly round-trips a label value with backslash followed by n (not a newline)', () => {
    const original = 'path\\nfile';
    expect(unescapeLabelValue(escapeLabelValueInExactSelector(original))).toBe(original);
  });

  it('correctly round-trips a label value with Windows CRLF and tab', () => {
    const original = 'message:\r\n\tdetail';
    expect(unescapeLabelValue(escapeLabelValueInExactSelector(original))).toBe(original);
  });
});

describe('escapeLabelValueInRegexSelector()', () => {
  it('handles newline characters', () => {
    expect(escapeLabelValueInRegexSelector('t\nes\nt')).toBe('t\\nes\\nt');
  });

  it('handles backslash characters', () => {
    expect(escapeLabelValueInRegexSelector('t\\es\\t')).toBe('t\\\\\\\\es\\\\\\\\t');
  });

  it('handles double-quote characters', () => {
    expect(escapeLabelValueInRegexSelector('t"es"t')).toBe('t\\"es\\"t');
  });

  it('handles regex-meaningful characters', () => {
    expect(escapeLabelValueInRegexSelector('t+es$t')).toBe('t\\\\+es\\\\$t');
  });

  it('handles all together', () => {
    expect(escapeLabelValueInRegexSelector('t\\e"s+t\nl\n$ab"e\\l')).toBe(
      't\\\\\\\\e\\"s\\\\+t\\nl\\n\\\\$ab\\"e\\\\\\\\l'
    );
  });
});
