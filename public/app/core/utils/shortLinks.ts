import memoizeOne from 'memoize-one';
import { getBackendSrv, config } from '@grafana/runtime';
import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { copyStringToClipboard } from './explore';

function buildHostUrl() {
  return `${window.location.protocol}//${window.location.host}${config.appSubUrl}`;
}

function getRelativeURLPath(url: string) {
  let path = url.replace(buildHostUrl(), '');
  return path.startsWith('/') ? path.substring(1, path.length) : path;
}

export const createShortLink = memoizeOne(async function(path: string) {
  try {
    const shortLink = await getBackendSrv().post(`/api/short-urls`, {
      path: getRelativeURLPath(path),
    });
    return shortLink.url;
  } catch (err) {
    console.error('Error when creating shortened link: ', err);
    appEvents.emit(AppEvents.alertError, ['Error generating shortened link']);
  }
});

export const createAndCopyShortLink = async (path: string) => {
  const shortLink = await createShortLink(path);
  if (shortLink) {
    copyStringToClipboard(shortLink);
    appEvents.emit(AppEvents.alertSuccess, ['Shortened link copied to clipboard']);
  } else {
    appEvents.emit(AppEvents.alertError, ['Error generating shortened link']);
  }
};
