import { contextSrv } from 'app/core/services/context_srv';

import { generateUniqueTitle, getIsLazy, _resetRenderingContextCache } from './utils';

describe('getIsLazy', () => {
  const originalAuthenticatedBy = contextSrv.user.authenticatedBy;

  beforeEach(() => {
    _resetRenderingContextCache();
    contextSrv.user.authenticatedBy = '';
  });

  afterEach(() => {
    contextSrv.user.authenticatedBy = originalAuthenticatedBy;
  });

  it('should return true (lazy) when preload is false and not in render mode', () => {
    expect(getIsLazy(false)).toBe(true);
    expect(getIsLazy(undefined)).toBe(true);
  });

  it('should return false (not lazy) when preload is true', () => {
    expect(getIsLazy(true)).toBe(false);
  });

  it('should return false (not lazy) when authenticated by render', () => {
    contextSrv.user.authenticatedBy = 'render';
    expect(getIsLazy(undefined)).toBe(false);
    expect(getIsLazy(false)).toBe(false);
  });

  it('should return false (not lazy) when render=1 URL parameter is present', () => {
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?render=1&other=2' },
      writable: true,
      configurable: true,
    });

    expect(getIsLazy(undefined)).toBe(false);

    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: originalSearch },
      writable: true,
      configurable: true,
    });
  });
});

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
