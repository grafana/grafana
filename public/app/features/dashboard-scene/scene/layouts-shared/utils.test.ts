import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { generateUniqueTitle, getIsLazy } from './utils';

describe('getIsLazy', () => {
  const originalUser = contextSrv.user;
  const originalDefault = config.dashboardDefaultPreload;

  beforeEach(() => {
    contextSrv.user = { ...originalUser, authenticatedBy: '' };
    config.dashboardDefaultPreload = false;
  });

  afterAll(() => {
    contextSrv.user = originalUser;
    config.dashboardDefaultPreload = originalDefault;
  });

  it('is not lazy when preload is true', () => {
    expect(getIsLazy(true)).toBe(false);
  });

  it('is lazy when preload is false', () => {
    expect(getIsLazy(false)).toBe(true);
  });

  it('is lazy when preload is undefined', () => {
    expect(getIsLazy(undefined)).toBe(true);
  });

  // default_preload seeds new dashboards at creation time only. If it were read here, switching it
  // on would silently change every existing dashboard that has no preload value.
  it('ignores the instance default', () => {
    config.dashboardDefaultPreload = true;
    expect(getIsLazy(undefined)).toBe(true);
    expect(getIsLazy(false)).toBe(true);
  });

  it('is never lazy for the image renderer user', () => {
    contextSrv.user = { ...originalUser, authenticatedBy: 'render' };
    expect(getIsLazy(false)).toBe(false);
    expect(getIsLazy(undefined)).toBe(false);
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
