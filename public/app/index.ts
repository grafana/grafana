declare let __webpack_public_path__: string;
__webpack_public_path__ = window.public_cdn_path;

import app from './app';
app.initEchoSrv();
app.init();
