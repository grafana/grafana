import { cacheStore } from 'react-inlinesvg';

export let cacheInitialized = false;
export let iconRoot = 'public/img/icons/';

export function initIconCache() {
  cacheInitialized = true;

  // This function needs to be called after index.js loads to give the
  // application time to modify __webpack_public_path__ with a CDN path
  const grafanaPublicPath = (window as any).__grafana_public_path__;
  if (grafanaPublicPath) {
    iconRoot = grafanaPublicPath + 'img/icons/';
  }

  //@ts-ignore
  const icons = require.context(
    '../../../../../public/img/icons',
    true,
    /^img\/icons\/(unicons|mono|custom)\/.*\.svg$/,
    'sync'
  );

  //@ts-ignore
  icons.keys().forEach((key) => {
    cacheStore['public/' + key] = { content: icons<string>(key), status: 'loaded', queue: [] };
  });
}
