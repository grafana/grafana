import { store, Store } from './store';

describe('Store', () => {
  let store: Store;
  let mockStorage: { [key: string]: string };

  beforeEach(() => {
    mockStorage = {};
    Object.defineProperty(window, 'localStorage', {
      value: new Proxy(mockStorage, {
        get(target, prop) {
          if (prop === 'removeItem') {
            return (key: string) => {
              delete target[key];
            };
          }
          return target[prop as string];
        },
        set(target, prop, value) {
          target[prop as string] = value;
          return true;
        },
        deleteProperty(target, prop) {
          delete target[prop as string];
          return true;
        },
      }),
      writable: true,
    });
    store = new Store();
  });

  describe('subscribe', () => {
    it('should call subscriber when value changes', () => {
      const testKey = 'test-key';
      const subscriber = jest.fn();
      const unsubscribe = store.subscribe(testKey, subscriber);

      store.set(testKey, 'test-value');
      expect(subscriber).toHaveBeenCalledTimes(1);
      store.set(testKey, 'another-value');
      expect(subscriber).toHaveBeenCalledTimes(2);

      unsubscribe();
      store.set(testKey, 'third-value');
      expect(subscriber).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple subscribers for the same key', () => {
      const testKey = 'test-key';
      const subscriber1 = jest.fn();
      const subscriber2 = jest.fn();

      store.subscribe(testKey, subscriber1);
      store.subscribe(testKey, subscriber2);

      store.set(testKey, 'test-value');

      expect(subscriber1).toHaveBeenCalledTimes(1);
      expect(subscriber2).toHaveBeenCalledTimes(1);
    });
  });

  describe('storage operations', () => {
    it('should store and retrieve values without subscribers', () => {
      const testKey = 'test-key';
      const testValue = 'test-value';

      store.set(testKey, testValue);
      expect(store.get(testKey)).toBe(testValue);

      const newValue = 'new-value';
      store.set(testKey, newValue);
      expect(store.get(testKey)).toBe(newValue);

      store.delete(testKey);
      expect(store.exists(testKey)).toBe(false);
      expect(store.get(testKey)).toBe(undefined);

      expect(window.localStorage[testKey]).toBe(undefined);
    });
  });
});

/* tests moved here from public/app/core/specs/store.test.ts */
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
