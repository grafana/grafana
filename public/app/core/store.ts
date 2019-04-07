type StoreValue = string | number | boolean | null;

export class Store {
  get(key: string) {
    return window.localStorage[key];
  }

  set(key: string, value: StoreValue) {
    window.localStorage[key] = value;
  }

  getBool(key: string, def: any) {
    if (def !== void 0 && !this.exists(key)) {
      return def;
    }
    return window.localStorage[key] === 'true';
  }

  getObject(key: string, def?: any) {
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

  // Returns true when successfully stored
  setObject(key: string, value: any): boolean {
    let json;
    try {
      json = JSON.stringify(value);
    } catch (error) {
      console.error(`Could not stringify object: ${key}. [${error}]`);
      return false;
    }
    try {
      this.set(key, json);
    } catch (error) {
      // Likely hitting storage quota
      console.error(`Could not save item in localStorage: ${key}. [${error}]`);
      return false;
    }
    return true;
  }

  exists(key: string) {
    return window.localStorage[key] !== void 0;
  }

  delete(key: string) {
    window.localStorage.removeItem(key);
  }
}

const store = new Store();
export default store;
