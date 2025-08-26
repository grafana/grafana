import { generateTimestamp } from './timestamp';

describe('generateTimestamp', () => {
  it('should generate a timestamp in the expected format', () => {
    const timestamp = generateTimestamp();

    // Check that the timestamp is a string
    expect(typeof timestamp).toBe('string');

    // Check that the timestamp follows the format YYYY-MM-DD-xxxxx
    // where xxxxx is a random string of 5 alphabetic characters
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}-[a-zA-Z]{5}$/);
  });

  it('should generate unique timestamps', () => {
    // Generate multiple timestamps and check that they're different
    const timestamp1 = generateTimestamp();
    const timestamp2 = generateTimestamp();
    const timestamp3 = generateTimestamp();

    // The date part might be the same, but the random part should make them different
    expect(timestamp1).not.toBe(timestamp2);
    expect(timestamp1).not.toBe(timestamp3);
    expect(timestamp2).not.toBe(timestamp3);
  });
});
