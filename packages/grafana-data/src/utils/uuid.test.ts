import { generateUUID } from './uuid';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateUUID', () => {
  it('returns a valid v4 UUID string', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(UUID_V4_REGEX);
  });

  it('sets the version nibble to 4', () => {
    const uuid = generateUUID();
    expect(uuid[14]).toBe('4');
  });

  it('sets the variant bits correctly', () => {
    const uuid = generateUUID();
    const variantChar = uuid[19];
    expect(['8', '9', 'a', 'b']).toContain(variantChar);
  });

  it('produces unique values', () => {
    const uuids = new Set(Array.from({ length: 1000 }, () => generateUUID()));
    expect(uuids.size).toBe(1000);
  });

  describe('when crypto.randomUUID is available', () => {
    const fakeUUID = '12345678-1234-4123-8123-123456789abc';

    beforeEach(() => {
      Object.defineProperty(crypto, 'randomUUID', {
        value: jest.fn().mockReturnValue(fakeUUID),
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, writable: true, configurable: true });
    });

    it('delegates to crypto.randomUUID', () => {
      const result = generateUUID();
      expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
      expect(result).toBe(fakeUUID);
    });
  });

  describe('when crypto.randomUUID is not available', () => {
    let originalRandomUUID: typeof crypto.randomUUID;

    beforeEach(() => {
      originalRandomUUID = crypto.randomUUID;
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, writable: true, configurable: true });
    });

    afterEach(() => {
      Object.defineProperty(crypto, 'randomUUID', {
        value: originalRandomUUID,
        writable: true,
        configurable: true,
      });
    });

    it('falls back and still produces valid v4 UUIDs', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(UUID_V4_REGEX);
    });

    it('sets the version nibble to 4 in fallback', () => {
      const uuid = generateUUID();
      expect(uuid[14]).toBe('4');
    });

    it('sets the variant bits correctly in fallback', () => {
      const uuid = generateUUID();
      const variantChar = uuid[19];
      expect(['8', '9', 'a', 'b']).toContain(variantChar);
    });

    it('produces unique values in fallback', () => {
      const uuids = new Set(Array.from({ length: 1000 }, () => generateUUID()));
      expect(uuids.size).toBe(1000);
    });
  });
});
