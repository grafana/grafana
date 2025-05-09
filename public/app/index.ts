// FEMT index.html loads bootdata async so need to wait for that to complete.
// Non-FEMT sets this to an immediately resolved promise.
// It's important to wait for this until any other imports run, becuase there's a bunch
// of module-side effects that depend on the bootdata.
await window.__grafana_boot_data_promise;

import './core/trustedTypePolicies';
declare let __webpack_public_path__: string;
declare let __webpack_nonce__: string;

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

import app from './app';

app.init();
