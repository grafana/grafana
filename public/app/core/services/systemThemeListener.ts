let watcher: MediaQueryList | null = null;
let callback: (() => void) | null = null;

export function startSystemThemeListener(onChange: () => void) {
  stopSystemThemeListener();
  watcher = window.matchMedia('(prefers-color-scheme: light)');
  callback = onChange;
  watcher.addEventListener('change', callback);
}

export function stopSystemThemeListener() {
  if (watcher && callback) {
    watcher.removeEventListener('change', callback);
    watcher = null;
    callback = null;
  }
}
