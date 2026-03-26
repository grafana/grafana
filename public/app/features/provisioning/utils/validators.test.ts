import { validateNoHiddenCharacters } from './validators';

describe('validateNoHiddenCharacters', () => {
  // Should pass for valid inputs
  it('returns true for a normal ASCII string', () => {
    expect(validateNoHiddenCharacters('hello world')).toBe(true);
  });

  it('returns true for a valid PEM private key', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...base64...\n-----END RSA PRIVATE KEY-----';
    expect(validateNoHiddenCharacters(pem)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(validateNoHiddenCharacters('')).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(validateNoHiddenCharacters(undefined)).toBe(true);
  });

  it('returns true for string with newlines and carriage returns', () => {
    expect(validateNoHiddenCharacters('line1\r\nline2\nline3')).toBe(true);
  });

  it('returns true for string with tabs', () => {
    expect(validateNoHiddenCharacters('col1\tcol2')).toBe(true);
  });

  // Should fail for hidden characters
  it('returns error for zero-width space (U+200B)', () => {
    expect(validateNoHiddenCharacters('abc\u200Bdef')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for zero-width non-joiner (U+200C)', () => {
    expect(validateNoHiddenCharacters('abc\u200Cdef')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for zero-width joiner (U+200D)', () => {
    expect(validateNoHiddenCharacters('abc\u200Ddef')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for BOM (U+FEFF)', () => {
    expect(validateNoHiddenCharacters('\uFEFFkey content')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for left-to-right mark (U+200E)', () => {
    expect(validateNoHiddenCharacters('abc\u200Edef')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for right-to-left mark (U+200F)', () => {
    expect(validateNoHiddenCharacters('abc\u200Fdef')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for soft hyphen (U+00AD)', () => {
    expect(validateNoHiddenCharacters('abc\u00ADdef')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for word joiner (U+2060)', () => {
    expect(validateNoHiddenCharacters('abc\u2060def')).toEqual(expect.stringContaining('hidden'));
  });

  // Unicode whitespace that breaks btoa() but looks like a regular space
  it('returns error for thin space (U+2009)', () => {
    expect(validateNoHiddenCharacters('abc\u2009def')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for narrow no-break space (U+202F)', () => {
    expect(validateNoHiddenCharacters('abc\u202Fdef')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for ideographic space (U+3000)', () => {
    expect(validateNoHiddenCharacters('abc\u3000def')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for medium mathematical space (U+205F)', () => {
    expect(validateNoHiddenCharacters('abc\u205Fdef')).toEqual(expect.stringContaining('hidden'));
  });

  it('returns error for en space (U+2002)', () => {
    expect(validateNoHiddenCharacters('abc\u2002def')).toEqual(expect.stringContaining('hidden'));
  });
});
