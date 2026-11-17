class LocalStorageMock implements Storage {
  [key: string]: any;

  getItem(key: string) {
    return this[key] ?? null;
  }

  setItem(key: string, value: string) {
    this[key] = value;
  }

  clear() {
    Object.keys(this).forEach((key) => delete this[key]);
  }

  removeItem(key: string) {
    delete this[key];
  }

  key(index: number) {
    return Object.keys(this)[index] ?? null;
  }

  get length() {
    return Object.keys(this).length;
  }
}

export function mockLocalStorage(): Storage {
  return new LocalStorageMock();
}
