/**
 * Modified from the MIT licensed project:
 * https://github.com/chriswheeldon/trie.ts/blob/master/src/index.ts
 */

import { Trie } from './trie';

describe('trie', () => {
  describe('contains', () => {
    it('should return false if empty string not found', () => {
      const t = new Trie<number>();
      expect(t.contains('')).toBeFalsy();
    });
    it('should return false if key not found', () => {
      const t = new Trie<number>();
      expect(t.contains('hello')).toBeFalsy();
    });
    it('should return false if prefix match', () => {
      const t = new Trie<number>();
      t.insert('hello', 99);
      expect(t.contains('hell')).toBeFalsy();
    });
    it('should return false if substring match', () => {
      const t = new Trie<number>();
      t.insert('hello', 99);
      expect(t.contains('hello,world')).toBeFalsy();
    });
    it('should return true if exact match', () => {
      const t = new Trie<number>();
      t.insert('hello', 99);
      expect(t.contains('hello')).toBeTruthy();
    });
    it('should return true if exact match on empty string', () => {
      const t = new Trie<number>();
      t.insert('', 99);
      expect(t.contains('')).toBeTruthy();
    });
  });

  describe('length', () => {
    it('should initially be 0', () => {
      const t = new Trie<number>();
      expect(t.length).toBe(0);
    });
    it('should increment on insert', () => {
      const t = new Trie<number>();
      t.insert('', 1);
      expect(t.length).toBe(1);
      t.insert('a', 2);
      expect(t.length).toBe(2);
      t.insert('c', 3);
      expect(t.length).toBe(3);
    });
    it('should decrement on remove', () => {
      const t = new Trie<number>();
      t.insert('', 1);
      t.insert('a', 2);
      t.insert('c', 3);
      t.remove('');
      expect(t.length).toBe(2);
      t.remove('c');
      expect(t.length).toBe(1);
      t.remove('a');
      expect(t.length).toBe(0);
      t.remove('a');
      expect(t.length).toBe(0);
    });
    it('should handle duplicate insert', () => {
      const t = new Trie<number>();
      t.insert('a', 1);
      t.insert('a', 1);
      t.insert('a', 1);
      t.insert('a', 1);
      expect(t.length).toBe(1);
    });
  });

  describe('get', () => {
    it('should return null if key not found', () => {
      const t = new Trie<number>();
      expect(t.get('abc')).toBeUndefined();
    });
    it('should return null if prefix match', () => {
      const t = new Trie<number>();
      t.insert('abcdef', 99);
      expect(t.get('abc')).toBeUndefined();
    });
    it('should return value if key found', () => {
      const t = new Trie<number>();
      t.insert('abc', 99);
      expect(t.get('abc')).toBe(99);
    });
  });

  describe('find', () => {
    it('should return null if key not found', () => {
      const t = new Trie<number>();
      expect(t.find('abc')).toBeUndefined();
    });
    it('should return null if prefix match', () => {
      const t = new Trie<number>();
      t.insert('abcdef', 99);
      expect(t.find('abc')).toBeUndefined();
    });
    it('should return value if key found', () => {
      const t = new Trie<number>();
      t.insert('abc', 99);
      expect(t.find('abc')).toBe(99);
    });
    it('should return value for prefix', () => {
      const t = new Trie<number>();
      t.insert('abc', 99);
      expect(t.find('abc/xyz')).toBe(99);
    });

    it('should match plugin names', () => {
      const t = new Trie<number>();
      t.insert('abc', 1);
      t.insert('xyz', 2);
      t.insert('abc/12', 3);
      t.insert('abc/123', 4);

      expect(t.find('?')).toBeUndefined();
      expect(t.find('abc')).toBe(1);
      expect(t.find('abc/')).toBe(1);
      expect(t.find('abc/12')).toBe(3);
      expect(t.find('abc/123')).toBe(4);
      expect(t.find('abc/123456')).toBe(4);
      expect(t.find('abc/???')).toBe(1);

      expect(t.getKeys()).toMatchInlineSnapshot(`
        Array [
          "abc",
          "abc/12",
          "abc/123",
          "xyz",
        ]
      `);
    });
  });

  describe('insert', () => {
    it('should handle empty key', () => {
      const t = new Trie<number>();
      t.insert('', 99);
      expect(t.contains('')).toBe(true);
      expect(t.get('')).toBe(99);
      expect(t.length).toBe(1);
    });
    it('should handle common prefix', () => {
      const t = new Trie<number>();
      t.insert('', 1);
      t.insert('abc', 2);
      t.insert('abcdef', 3);
      expect(t.get('')).toBe(1);
      expect(t.get('abc')).toBe(2);
      expect(t.get('abcdef')).toBe(3);
      expect(t.length).toBe(3);
    });
    it('should replace if duplicate', () => {
      const t = new Trie<number>();
      t.insert('abc', 2);
      t.insert('abc', 3);
      t.insert('abc', 4);
      expect(t.get('abc')).toBe(4);
    });
    it('should handle node insertion', () => {
      const t = new Trie<number>();
      t.insert('abcdef', 3);
      t.insert('abc', 2);
      t.insert('', 1);
      expect(t.get('')).toBe(1);
      expect(t.get('abc')).toBe(2);
      expect(t.get('abcdef')).toBe(3);
      expect(t.length).toBe(3);
    });
    it('should handle node splitting', () => {
      const t = new Trie<number>();
      t.insert('bar', 3);
      t.insert('bat', 2);
      t.insert('baz', 1);
      expect(t.get('baz')).toBe(1);
      expect(t.get('bat')).toBe(2);
      expect(t.get('bar')).toBe(3);
      expect(t.length).toBe(3);
    });
  });

  describe('remove', () => {
    it('should handle empty key', () => {
      const t = new Trie<number>();
      t.insert('', 99);
      t.remove('');
      expect(t.contains('')).toBeFalsy();
    });
    it('should handle common prefix', () => {
      const t = new Trie<number>();
      t.insert('', 1);
      t.insert('abc', 2);
      t.insert('abcdef', 3);
      t.remove('abc');
      expect(t.contains('')).toBeTruthy();
      expect(t.contains('abc')).toBeFalsy();
      expect(t.contains('abcdef')).toBeTruthy();
    });
  });
});
