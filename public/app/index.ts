// The new index.html fetches window.grafanaBootData asynchronously.
// Since much of Grafana depends on it in includes side effects at import time,
// we delay loading the rest of the app using import() until the boot data is ready.

// Check if we are hosting files on cdn and set webpack public path
if (window.public_cdn_path) {
  __webpack_public_path__ = window.public_cdn_path;
}

// This is a path to the public folder without '/build'
window.__grafana_public_path__ =
  __webpack_public_path__.substring(0, __webpack_public_path__.lastIndexOf('build/')) || __webpack_public_path__;

if (window.nonce) {
  __webpack_nonce__ = window.nonce;
}

// This is an indication to the window.onLoad failure check that the app bundle has loaded.
window.__grafana_app_bundle_loaded = true;

async function bootstrapWindowData() {
  // Wait for window.grafanaBootData is ready. The new index.html loads it from
  // an API call, but the old one just sets an immediately resolving promise.
  await window.__grafana_boot_data_promise;

  // Use eager to ensure the app is included in the initial chunk and does not
  // require additional network requests to load.
  await import(/* webpackMode: "eager" */ './initApp');
}

bootstrapWindowData().catch((error) => {
  console.error('Error bootstrapping Grafana', error);
  window.__grafana_load_failed();
});
