import store from '../store';

Object.assign(window, {
  localStorage: {
    removeItem(key) {
      delete window.localStorage[key];
    },
  },
});

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

  it('key should be deleted', () => {
    store.set('key6', '123');
    store.delete('key6');
    expect(store.exists('key6')).toBe(false);
  });
});
