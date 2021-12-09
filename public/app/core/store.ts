type StoreValue = string | number | boolean | null;
type StoreType = 'local' | 'session';

export class Store {
  private readonly store: Storage;

  constructor(private readonly type: StoreType = 'local') {
    if (this.type === 'local') {
      this.store = window.localStorage;
    } else {
      this.store = window.sessionStorage;
    }
  }

  get(key: string) {
    return this.store[key];
  }

  set(key: string, value: StoreValue) {
    this.store[key] = value;
  }

  getBool(key: string, def: boolean): boolean {
    if (def !== void 0 && !this.exists(key)) {
      return def;
    }
    return this.store[key] === 'true';
  }

  getObject(key: string, def?: any) {
    let ret = def;
    if (this.exists(key)) {
      const json = this.store[key];
      try {
        ret = JSON.parse(json);
      } catch (error) {
        console.error(`Error parsing store object: ${key}. Returning default: ${def}. [${error}]`);
      }
    }
    return ret;
  }

  /* Returns true when successfully stored, throws error if not successfully stored */
  setObject(key: string, value: any) {
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
      errorToThrow.name = error.name;
      throw errorToThrow;
    }
    return true;
  }

  exists(key: string) {
    return this.store[key] !== void 0;
  }

  delete(key: string) {
    this.store.removeItem(key);
  }
}

const store = new Store();
export default store;
