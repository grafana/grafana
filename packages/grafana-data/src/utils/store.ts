/* eslint-disable @grafana/no-direct-local-storage-access */
type StoreValue = string | number | boolean | null;
type StoreSubscriber = () => void;

/**
 * @deprecated Import singleton instance 'store' from '@grafana/data' instead
 */
export class Store {
  private subscribers: Map<string, Set<StoreSubscriber>> = new Map();

  constructor() {
    // Changes from other tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key) {
          this.notifySubscribers(e.key);
        }
      });
    }
  }

  // Storage is optional: on SSR, or in sandboxed/opaque-origin iframes where the
  // window.localStorage getter itself throws, reads return undefined and writes are dropped.
  private get storage(): Storage | undefined {
    try {
      return typeof window === 'undefined' ? undefined : window.localStorage;
    } catch {
      return undefined;
    }
  }

  private read(key: string): string | undefined {
    try {
      return this.storage?.[key];
    } catch {
      return undefined;
    }
  }

  private notifySubscribers(key: string) {
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      keySubscribers.forEach((subscriber) => subscriber());
    }
  }

  subscribe(key: string, callback: StoreSubscriber) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      const keySubscribers = this.subscribers.get(key);
      if (keySubscribers) {
        keySubscribers.delete(callback);
        if (keySubscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  get(key: string) {
    return this.read(key);
  }

  set(key: string, value: StoreValue) {
    if (this.storage) {
      this.storage[key] = value;
    }
    this.notifySubscribers(key);
  }

  getBool(key: string, def: boolean): boolean {
    if (def !== void 0 && !this.exists(key)) {
      return def;
    }
    return this.read(key) === 'true';
  }

  getObject<T = unknown>(key: string): T | undefined;
  getObject<T = unknown>(key: string, def: T): T;
  getObject<T = unknown>(key: string, def?: T) {
    let ret = def;
    if (this.exists(key)) {
      const json = this.read(key);
      try {
        ret = JSON.parse(json ?? '');
      } catch (error) {
        console.error(`Error parsing store object: ${key}. Returning default: ${def}. [${error}]`);
      }
    }
    return ret;
  }

  /* Returns true when successfully stored, throws error if not successfully stored */
  setObject(key: string, value: unknown) {
    let json;
    try {
      json = JSON.stringify(value);
    } catch (error) {
      throw new Error(`Could not stringify object: ${key}. [${error}]`);
    }
    try {
      this.set(key, json);
    } catch (error) {
      // Likely hitting storage quota
      const errorToThrow = new Error(`Could not save item in localStorage: ${key}. [${error}]`);
      if (error instanceof Error) {
        errorToThrow.name = error.name;
      }
      throw errorToThrow;
    }
    return true;
  }

  exists(key: string) {
    return this.read(key) !== void 0;
  }

  delete(key: string) {
    try {
      this.storage?.removeItem(key);
    } catch {
      // storage became unavailable; nothing to remove
    }
    this.notifySubscribers(key);
  }

  all(prefix?: string): Record<string, string> {
    const result: Record<string, string> = {};
    const storage = this.storage;
    if (!storage) {
      return result;
    }
    try {
      for (let i = 0; i < storage.length; i++) {
        const rawKey = storage.key(i);
        if (rawKey && rawKey.startsWith(prefix ?? '')) {
          const key = rawKey.slice(prefix?.length ?? 0);
          const value = storage.getItem(rawKey);
          if (value !== null) {
            result[key] = value;
          }
        }
      }
    } catch {
      return {};
    }
    return result;
  }
}

export const store = new Store();
