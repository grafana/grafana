type StoreValue = string | number | boolean | null;
type StoreSubscriber = () => void;

/**
 * @deprecated Import singleton instance 'store' from '@grafana/data' instead
 */
export class Store {
  private subscribers: Map<string, Set<StoreSubscriber>> = new Map();

  constructor() {
    // Changes from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key) {
        this.notifySubscribers(e.key);
      }
    });
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
    return window.localStorage[key];
  }

  set(key: string, value: StoreValue) {
    window.localStorage[key] = value;
    this.notifySubscribers(key);
  }

  getBool(key: string, def: boolean): boolean {
    if (def !== void 0 && !this.exists(key)) {
      return def;
    }
    return window.localStorage[key] === 'true';
  }

  getObject<T = unknown>(key: string): T | undefined;
  getObject<T = unknown>(key: string, def: T): T;
  getObject<T = unknown>(key: string, def?: T) {
    let ret = def;
    if (this.exists(key)) {
      const json = window.localStorage[key];
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
    return window.localStorage[key] !== void 0;
  }

  delete(key: string) {
    window.localStorage.removeItem(key);
    this.notifySubscribers(key);
  }
}

export const store = new Store();
