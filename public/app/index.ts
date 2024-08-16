import './core/trustedTypePolicies';

declare global {
  interface Window {
    public_cdn_path?: string;
    nonce?: string;
    __grafana_public_path__: string;
    __grafana_app_bundle_loaded: boolean;
  }
}

declare let __webpack_public_path__: string;
declare let __webpack_nonce__: string;

// Set webpack public path if CDN is used
if (window.public_cdn_path) {
  __webpack_public_path__ = window.public_cdn_path;
}

// Set public path without '/build'
window.__grafana_public_path__ = __webpack_public_path__.substring(0, __webpack_public_path__.lastIndexOf('build/')) || __webpack_public_path__;

// Set webpack nonce if available
if (window.nonce) {
  __webpack_nonce__ = window.nonce;
}

// Indicate that the app bundle has loaded
window.__grafana_app_bundle_loaded = true;

// Import and initialize the app
import app from './app';
app.init();
