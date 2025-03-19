import { Store } from './store';

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
