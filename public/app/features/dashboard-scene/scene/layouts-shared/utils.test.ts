import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import { generateUniqueTitle, getIsLazy } from './utils';

jest.mock('app/features/dashboard/services/isRenderTarget', () => ({
  isRenderTarget: jest.fn(),
}));

describe('generateUniqueTitle', () => {
  it('should return the original title if it is not in the existing titles', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['Other Title', 'Another Title']);
    expect(generateUniqueTitle(title, existingTitles)).toBe(title);
  });

  it('should handle undefined title by using empty string as base', () => {
    const existingTitles = new Set<string>(['Title 1', 'Title 2']);
    expect(generateUniqueTitle(undefined, existingTitles)).toBe('');
  });

  it('should append "1" to a title that does not end with a number', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['My Title']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 1');
  });

  it('should increment a number at the end of a title', () => {
    const title = 'My Title 1';
    const existingTitles = new Set<string>(['My Title 1', 'My Title 2']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 3');
  });

  it('should handle multiple increments when needed', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['My Title', 'My Title 1', 'My Title 2', 'My Title 3']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 4');
  });

  it('should handle titles with multiple numbers', () => {
    const title = 'My Title 123';
    const existingTitles = new Set<string>(['My Title 123', 'My Title 124']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 125');
  });

  it('should handle titles with spaces before the number', () => {
    const title = 'My Title  1';
    const existingTitles = new Set<string>(['My Title  1', 'My Title  2']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title  3');
  });

  it('should handle empty existing titles set', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>();
    expect(generateUniqueTitle(title, existingTitles)).toBe(title);
  });
});

describe('getIsLazy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each`
    preload      | isRenderTargetValue | expected
    ${false}     | ${false}            | ${true}
    ${undefined} | ${false}            | ${true}
    ${true}      | ${false}            | ${false}
    ${false}     | ${true}             | ${false}
    ${undefined} | ${true}             | ${false}
    ${true}      | ${true}             | ${false}
  `(
    'should return $expected when preload is $preload and isRenderTarget returns $isRenderTargetValue',
    ({ preload, isRenderTargetValue, expected }) => {
      jest.mocked(isRenderTarget).mockReturnValue(isRenderTargetValue);

      expect(getIsLazy(preload)).toBe(expected);
    }
  );
});
