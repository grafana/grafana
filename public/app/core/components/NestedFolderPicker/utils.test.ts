import { getFolderPath } from './utils';

describe('getFolderPath', () => {
  it('returns undefined for a folder that is not in the index', () => {
    expect(getFolderPath({}, 'missing')).toBeUndefined();
  });

  it('returns no titles for a root-level folder', () => {
    const index = { a: { name: 'A' } };
    expect(getFolderPath(index, 'a')).toEqual({ titles: [], hasUnknownAncestor: false });
  });

  it('returns ancestors from the outermost down to the immediate parent', () => {
    const index = {
      a: { name: 'A' },
      b: { name: 'B', parentUID: 'a' },
      c: { name: 'C', parentUID: 'b' },
    };
    expect(getFolderPath(index, 'c')).toEqual({ titles: ['A', 'B'], hasUnknownAncestor: false });
  });

  it('marks a parent the user cannot see as unknown and stops there', () => {
    const index = {
      b: { name: 'B', parentUID: 'hidden' },
      c: { name: 'C', parentUID: 'b' },
    };
    expect(getFolderPath(index, 'c')).toEqual({ titles: ['[Unknown folder]', 'B'], hasUnknownAncestor: true });
  });

  it('marks a hidden immediate parent as unknown', () => {
    const index = { c: { name: 'C', parentUID: 'hidden' } };
    expect(getFolderPath(index, 'c')).toEqual({ titles: ['[Unknown folder]'], hasUnknownAncestor: true });
  });

  it('stops on a cycle instead of looping forever', () => {
    const index = {
      a: { name: 'A', parentUID: 'b' },
      b: { name: 'B', parentUID: 'a' },
    };
    expect(getFolderPath(index, 'a')).toEqual({ titles: ['B'], hasUnknownAncestor: false });
  });
});
