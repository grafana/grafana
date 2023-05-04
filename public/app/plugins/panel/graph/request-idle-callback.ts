// Shim from https://developers.google.com/web/updates/2015/08/using-requestidlecallback
function requestIdleCallbackShim(cb: any) {
  const start = Date.now();
  return setTimeout(function () {
    cb({
      didTimeout: false,
      timeRemaining: function () {
        return Math.max(0, 50 - (Date.now() - start))
      },
    })
  }, 1)
}

export const requestIdleCallback = typeof window !== "undefined"
  ? window.requestIdleCallback || requestIdleCallbackShim
  : requestIdleCallbackShim
