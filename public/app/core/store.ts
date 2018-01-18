export class Store {
  get(key) {
    return window.localStorage[key];
  }

  set(key, value) {
    window.localStorage[key] = value;
  }

  getBool(key, def) {
    if (def !== void 0 && !this.exists(key)) {
      return def;
    }
    return window.localStorage[key] === 'true';
  }

  exists(key) {
    return window.localStorage[key] !== void 0;
  }

  delete(key) {
    window.localStorage.removeItem(key);
  }
}

const store = new Store();
export default store;
