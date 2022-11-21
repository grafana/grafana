import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from './languageUtils';

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

  it('handles all together', () => {
    expect(escapeLabelValueInExactSelector('t\\e"st\nl\nab"e\\l')).toBe('t\\\\e\\"st\\nl\\nab\\"e\\\\l');
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
