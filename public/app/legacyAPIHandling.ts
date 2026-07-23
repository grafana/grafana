// Controlled by the ``
export function patchFetchForLegacyAPIMode() {
  const mode = window.__grafanaLegacyAPIMode;
  if (mode !== 'log' && mode !== 'block') {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = input instanceof Request ? input.url : input.toString();
    const url = new URL(rawUrl, window.location.href);
    const isLegacyAPICall = url.origin === window.location.origin && url.pathname.startsWith('/api/');

    if (isLegacyAPICall) {
      if (mode === 'block') {
        return Promise.reject(new Error(`Request to legacy api ${url.pathname} blocked`));
      }

      console.warn(`Request made to to legacy api ${url.pathname}`);
    }

    return originalFetch(input, init);
  };
}
