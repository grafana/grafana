import { formatString } from './helpers';

describe('JSONFormatter helpers', () => {
  describe('escapeString', () => {
    it("does not escape strings that don't contain quotes", () => {
      const input = 'hello world';
      const expected = 'hello world';

      const result = formatString(input);
      expect(result).toEqual(expected);
    });

    it('does not escape strings that contain single quotes', () => {
      const input = `'hello world'`;
      const expected = `'hello world'`;

      const result = formatString(input);
      expect(result).toEqual(expected);
    });

    it('does escapes strings that contain one double quote', () => {
      const input = `"hello world`;
      const expected = `\\"hello world`;

      const result = formatString(input);
      expect(result).toEqual(expected);
    });

    it('does escapes strings that contain two double quotes', () => {
      const input = `"hello world"`;
      const expected = `\\"hello world\\"`;

      const result = formatString(input);
      expect(result).toEqual(expected);
    });

    it('does escapes a string that looks like JSON', () => {
      const input = `{"hello": "world"}`;
      const expected = `{\\"hello\\": \\"world\\"}`;

      const result = formatString(input);
      expect(result).toEqual(expected);
    });
  });
});
