declare let __webpack_public_path__: string;
declare let __webpack_nonce__: string;

/**
 * Check if we are hosting files on cdn and set webpack public path
 */
if ((window as any).public_cdn_path) {
  __webpack_public_path__ = (window as any).public_cdn_path;
}

if ((window as any).nonce) {
  __webpack_nonce__ = (window as any).nonce;
}

import app from './app';
app.init();
