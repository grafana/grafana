import { renderHook } from '@testing-library/react';

import { useGetFormattedDate } from './hooks';

describe('useGetFormattedDate', () => {
  beforeAll(() => {
    // Moment will console.warn about invalid dates
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // @ts-expect-error
    console.warn.mockClear();
  });

  afterAll(() => {
    // @ts-expect-error
    console.warn.mockRestore();
  });

  it('should handle invalid date with seconds', () => {
    const { result } = renderHook(() => useGetFormattedDate(true));
    const formattedDate = result.current('invalid date');
    expect(formattedDate).toMatch(/(\d){4}-(\d){2}-(\d){2} (\d){2}:(\d){2}:(\d){2}/);
  });

  it('should handle invalid date without seconds', () => {
    // jest.spyOn(console, 'warn').mockImplementation();
    const { result } = renderHook(() => useGetFormattedDate(false));
    const formattedDate = result.current('invalid date');
    expect(formattedDate).toMatch(/(\d){4}-(\d){2}-(\d){2} (\d){2}:(\d){2}/);
  });

  it('should show seconds', () => {
    // Test not implemented: useGetFormattedDate
    const { result } = renderHook(() => useGetFormattedDate(true));
    const formattedDate = result.current(new Date('2021-05-05 12:00:00'));
    expect(formattedDate).toBe('2021-05-05 12:00:00');
  });

  it('should not show seconds', () => {
    const { result } = renderHook(() => useGetFormattedDate(false));
    const formattedDate = result.current(new Date('2021-05-05 12:00:00'));
    expect(formattedDate).toBe('2021-05-05 12:00');
  });
});
