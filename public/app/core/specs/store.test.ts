import store from '../store';

describe('store', () => {
  it('should store', () => {
    store.set('key1', '123');
    expect(store.get('key1')).toBe('123');
  });

  it('get key when undefined', () => {
    expect(store.get('key2')).toBe(undefined);
  });

  it('check if key exixts', () => {
    store.set('key3', '123');
    expect(store.exists('key3')).toBe(true);
  });

  it('get boolean when no key', () => {
    expect(store.getBool('key4', false)).toBe(false);
  });

  it('get boolean', () => {
    store.set('key5', 'true');
    expect(store.getBool('key5', false)).toBe(true);
  });

  it('gets an object', () => {
    expect(store.getObject('object1')).toBeUndefined();
    expect(store.getObject('object1', [])).toEqual([]);
    store.setObject('object1', [1]);
    expect(store.getObject('object1')).toEqual([1]);
  });

  it('sets an object', () => {
    expect(store.setObject('object2', { a: 1 })).toBe(true);
    expect(store.getObject('object2')).toEqual({ a: 1 });
  });

  it('key should be deleted', () => {
    store.set('key6', '123');
    store.delete('key6');
    expect(store.exists('key6')).toBe(false);
  });
});
