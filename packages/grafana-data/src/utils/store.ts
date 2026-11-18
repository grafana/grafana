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

  // Used instead of localStorage when it is unavailable (SSR, or sandboxed/opaque-origin iframes
  // where the getter or operations throw SecurityError), so values persist for the page lifetime.
  private memory = new Map<string, string>();

  private get storage(): Storage | undefined {
    try {
      return typeof window === 'undefined' ? undefined : window.localStorage;
    } catch {
      return undefined;
    }
  }

  // Returns `any` like the localStorage index signature it replaces, to keep existing callers compiling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private read(key: string): any {
    const storage = this.storage;
    if (storage) {
      try {
        return storage[key];
      } catch {
        // fall through to the in-memory fallback
      }
    }
    return this.memory.get(key);
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

  /* Throws when storage is available but the write fails, e.g. QuotaExceededError */
  set(key: string, value: StoreValue) {
    const storage = this.storage;
    try {
      if (!storage) {
        this.memory.set(key, String(value));
      } else {
        storage[key] = value;
      }
    } catch (error) {
      if (!isUnavailableError(error)) {
        throw error;
      }
      this.memory.set(key, String(value));
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
        ret = JSON.parse(json);
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
    this.memory.delete(key);
    try {
      this.storage?.removeItem(key);
    } catch (error) {
      if (!isUnavailableError(error)) {
        throw error;
      }
    }
    this.notifySubscribers(key);
  }

  all(prefix?: string): Record<string, string> {
    const storage = this.storage;
    if (storage) {
      try {
        return collect(
          prefix,
          storage.length,
          (i) => storage.key(i),
          (k) => storage.getItem(k)
        );
      } catch {
        // fall through to the in-memory fallback
      }
    }
    const keys = [...this.memory.keys()];
    return collect(
      prefix,
      keys.length,
      (i) => keys[i],
      (k) => this.memory.get(k) ?? null
    );
  }
}

function isUnavailableError(error: unknown) {
  return error instanceof DOMException && error.name === 'SecurityError';
}

function collect(
  prefix: string | undefined,
  length: number,
  keyAt: (index: number) => string | null,
  getItem: (key: string) => string | null
): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < length; i++) {
    const rawKey = keyAt(i);
    if (rawKey && rawKey.startsWith(prefix ?? '')) {
      const value = getItem(rawKey);
      if (value !== null) {
        result[rawKey.slice(prefix?.length ?? 0)] = value;
      }
    }
  }
  return result;
}

export const store = new Store();
