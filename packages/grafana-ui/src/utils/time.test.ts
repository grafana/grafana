import { toUtc, rangeUtil } from '@grafana/data';

import { absoluteTimeRangeURL } from './time';

describe('absoluteTimeRangeURL', () => {
  const fakeSystemTime = new Date('2024-01-01T00:00:00Z').getTime();

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fakeSystemTime);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should return URL with default 30min time range when no time params present', () => {
    const url = 'http://localhost:3000/dashboard';
    const result = absoluteTimeRangeURL({ url });

    const expectedTo = toUtc(fakeSystemTime).valueOf().toString();
    const expectedFrom = toUtc(fakeSystemTime - 30 * 60 * 1000)
      .valueOf()
      .toString();

    expect(result).toBe(`http://localhost:3000/dashboard?to=${expectedTo}&from=${expectedFrom}`);
  });

  it('should convert relative time range to absolute', () => {
    const url = 'http://localhost:3000/dashboard?from=now-6h&to=now';
    const result = absoluteTimeRangeURL({ url });

    const expectedTo = toUtc(fakeSystemTime).valueOf().toString();
    const expectedFrom = toUtc(fakeSystemTime - 6 * 60 * 60 * 1000)
      .valueOf()
      .toString();

    expect(result).toBe(`http://localhost:3000/dashboard?from=${expectedFrom}&to=${expectedTo}`);
  });

  it('should return original URL when absolute time range is present', () => {
    const absoluteFrom = '2023-12-31T00:00:00Z';
    const absoluteTo = '2024-01-01T00:00:00Z';
    const url = `http://localhost:3000/dashboard?from=${absoluteFrom}&to=${absoluteTo}`;

    const result = absoluteTimeRangeURL({ url });

    expect(result).toBe(url);
  });

  it('should use custom parameter names when provided', () => {
    const url = 'http://localhost:3000/dashboard?start=now-1h&end=now';
    const result = absoluteTimeRangeURL({
      url,
      fromParam: 'start',
      toParam: 'end',
    });

    const expectedTo = toUtc(fakeSystemTime).valueOf().toString();
    const expectedFrom = toUtc(fakeSystemTime - 60 * 60 * 1000)
      .valueOf()
      .toString();

    expect(result).toBe(`http://localhost:3000/dashboard?start=${expectedFrom}&end=${expectedTo}`);
  });

  it('should use window.location when no URL is provided', () => {
    // Mock window.location
    const originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    // @ts-ignore
    window.location = new URL('http://localhost:3000/dashboard?from=now-1h&to=now');

    const result = absoluteTimeRangeURL();

    const expectedTo = toUtc(fakeSystemTime).valueOf().toString();
    const expectedFrom = toUtc(fakeSystemTime - 60 * 60 * 1000)
      .valueOf()
      .toString();

    expect(result).toBe(`http://localhost:3000/dashboard?from=${expectedFrom}&to=${expectedTo}`);

    // Restore window.location
    // @ts-ignore
    window.location = originalLocation;
  });

  it('should preserve other query parameters', () => {
    const url = 'http://localhost:3000/dashboard?from=now-6h&to=now&param1=value1&param2=value2';
    const result = absoluteTimeRangeURL({ url });

    const expectedTo = toUtc(fakeSystemTime).valueOf().toString();
    const expectedFrom = toUtc(fakeSystemTime - 6 * 60 * 60 * 1000)
      .valueOf()
      .toString();

    expect(result).toBe(
      `http://localhost:3000/dashboard?from=${expectedFrom}&to=${expectedTo}&param1=value1&param2=value2`
    );
  });

  it('should handle URLs with hash fragments', () => {
    const url = 'http://localhost:3000/dashboard?from=now-6h&to=now#panel-1';
    const result = absoluteTimeRangeURL({ url });

    const expectedTo = toUtc(fakeSystemTime).valueOf().toString();
    const expectedFrom = toUtc(fakeSystemTime - 6 * 60 * 60 * 1000)
      .valueOf()
      .toString();

    expect(result).toBe(`http://localhost:3000/dashboard?from=${expectedFrom}&to=${expectedTo}#panel-1`);
  });

  describe('error handling', () => {
    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url';
      const result = absoluteTimeRangeURL({ url: invalidUrl });

      expect(result).toBe(invalidUrl);
      // Update the test to match the actual error message
      expect(console.error).toHaveBeenCalledWith(
        'Error in absoluteTimeRangeURL:',
        expect.objectContaining({
          message: expect.stringContaining('Invalid URL'),
        })
      );
    });

    it('should handle invalid relative time ranges', () => {
      const url = 'http://localhost:3000/dashboard?from=invalid&to=now';
      const result = absoluteTimeRangeURL({ url });

      expect(result).toBe('http://localhost:3000/dashboard?from=invalid&to=now');
      expect(console.error).toHaveBeenCalledWith('Failed to convert relative time range:', expect.any(Error));
    });

    it('should handle null range values from convertRawToRange', () => {
      // mock rangeUtil to return null values
      // @ts-ignore
      jest.spyOn(rangeUtil, 'convertRawToRange').mockReturnValue({ from: null, to: null, raw: { from: '', to: '' } });

      const url = 'http://localhost:3000/dashboard?from=now-6h&to=now';
      const result = absoluteTimeRangeURL({ url });

      expect(result).toBe('http://localhost:3000/dashboard?from=now-6h&to=now');
      expect(console.error).toHaveBeenCalledWith('Failed to convert relative time range:', expect.any(Error));
    });
  });

  beforeEach(() => {
    // Mock console.error to prevent actual logging during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
