export function getFromLocalStorage(key: string) {
  const value = localStorage.getItem(key);
  if (!value) {
    return undefined;
  }
  return JSON.parse(value);
}

export function setInLocalStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}
