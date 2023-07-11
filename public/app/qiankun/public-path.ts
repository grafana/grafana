import { IS_QIANKUN } from './constants';

declare let __webpack_public_path__: string;
if (IS_QIANKUN) {
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ + 'public/build/';
}
