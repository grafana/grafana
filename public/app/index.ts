declare let __webpack_public_path__: string;

/**
 * Check if we are hosting files on cdn and set webpack public path
 */
if ((window as any).public_cdn_path) {
  __webpack_public_path__ = (window as any).public_cdn_path;
}

import app from './app';
app.initEchoSrv();
app.init();
