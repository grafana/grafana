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
          if (prop === 'length') {
            return Object.keys(target).length;
          }
          if (prop === 'key') {
            return (index: number) => Object.keys(target)[index] ?? null;
          }
          if (prop === 'getItem') {
            return (key: string) => target[key] ?? null;
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

  describe('all', () => {
    it('returns all keys', () => {
      store.set('service:user:key1', 'value1');
      store.set('service:user:key2', 'value2');
      store.set('other:user:key3', 'value3');

      const result = store.all();

      expect(result).toEqual({
        'service:user:key1': 'value1',
        'service:user:key2': 'value2',
        'other:user:key3': 'value3',
      });
    });

    it('returns all keys matching the given prefix', () => {
      store.set('service:user:key1', 'value1');
      store.set('service:user:key2', 'value2');
      store.set('other:user:key3', 'value3');

      const result = store.all('service:user:');

      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('returns empty object when no keys match the prefix', () => {
      store.set('other:user:key1', 'value1');

      const result = store.all('service:user:');

      expect(result).toEqual({});
    });
  });
});

describe('Store without window (SSR)', () => {
  const originalWindow = window;

  beforeEach(() => {
    // @ts-expect-error -- simulate a server environment where window is not defined
    delete global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it('does not throw when constructed or used', () => {
    expect(() => {
      const ssrStore = new Store();
      ssrStore.subscribe('key', jest.fn());
      ssrStore.set('key', 'value');
      ssrStore.setObject('key', { a: 1 });
      ssrStore.get('key');
      ssrStore.getBool('key', true);
      ssrStore.getObject('key', { a: 1 });
      ssrStore.exists('key');
      ssrStore.delete('key');
    }).not.toThrow();
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

describe('Store when localStorage is unavailable', () => {
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(window, 'localStorage', originalDescriptor);
    }
  });

  describe('getter throws (sandboxed iframe without allow-same-origin)', () => {
    let store: Store;

    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException("Failed to read the 'localStorage' property from 'Window'", 'SecurityError');
        },
      });
      store = new Store();
    });

    it('reads fall back to absent values and defaults', () => {
      expect(store.get('key')).toBeUndefined();
      expect(store.exists('key')).toBe(false);
      expect(store.getBool('key', true)).toBe(true);
      expect(store.getObject('key')).toBeUndefined();
      expect(store.getObject('key', { a: 1 })).toEqual({ a: 1 });
      expect(store.all()).toEqual({});
    });

    it('writes and removes do nothing but still notify subscribers', () => {
      const subscriber = jest.fn();
      store.subscribe('key', subscriber);

      expect(() => store.set('key', 'value')).not.toThrow();
      expect(store.setObject('key', { a: 1 })).toBe(true);
      expect(() => store.delete('key')).not.toThrow();
      expect(store.get('key')).toBeUndefined();
      expect(subscriber).toHaveBeenCalledTimes(3);
    });
  });

  describe('storage operations throw', () => {
    let store: Store;

    beforeEach(() => {
      const throwing = () => {
        throw new DOMException('denied', 'SecurityError');
      };
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: new Proxy({} as Storage, { get: throwing, set: throwing }),
      });
      store = new Store();
    });

    it('reads fall back to absent values and defaults', () => {
      expect(store.get('key')).toBeUndefined();
      expect(store.exists('key')).toBe(false);
      expect(store.getBool('key', false)).toBe(false);
      expect(store.getObject('key', [])).toEqual([]);
      expect(store.all('prefix.')).toEqual({});
    });

    it('delete does not throw', () => {
      expect(() => store.delete('key')).not.toThrow();
    });

    it('setObject still reports write failures such as quota errors', () => {
      expect(() => store.setObject('key', { a: 1 })).toThrow(/Could not save item in localStorage: key/);
    });
  });
});
