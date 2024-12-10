import './viteGlobals';
import 'vite/modulepreload-polyfill';
import './core/trustedTypePolicies';

// TODO: Vite does this differently...
// declare let __webpack_public_path__: string;
// declare let __webpack_nonce__: string;

// // Check if we are hosting files on cdn and set webpack public path
// if (window.public_cdn_path) {
//   __webpack_public_path__ = window.public_cdn_path;
// }

// // This is a path to the public folder without '/build'
// window.__grafana_public_path__ =
//   __webpack_public_path__.substring(0, __webpack_public_path__.lastIndexOf('build/')) || __webpack_public_path__;

// if (window.nonce) {
//   __webpack_nonce__ = window.nonce;
// }

// This is an indication to the window.onLoad failure check that the app bundle has loaded.
window.__grafana_app_bundle_loaded = true;

import app from './app';

const prepareInit = async () => {
  if (process.env.frontend_dev_mock_api) {
    return import('../test/mock-api/worker').then((workerModule) => {
      workerModule.default.start({ onUnhandledRequest: 'bypass' });
    });
  }
  return Promise.resolve();
};

prepareInit().then(() => {
  app.init();
});
