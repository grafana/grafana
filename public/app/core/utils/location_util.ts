import { getConfig } from 'app/core/config';

export const stripBaseFromUrl = (url: string): string => {
  const appSubUrl = getConfig().appSubUrl;
  const stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
  const urlWithoutBase =
    url.length > 0 && url.indexOf(appSubUrl) === 0 ? url.slice(appSubUrl.length - stripExtraChars) : url;

  return urlWithoutBase;
};

export const assureBaseUrl = (url: string) => {
  if (url.startsWith('/')) {
    return `${getConfig().appSubUrl}${stripBaseFromUrl(url)}`;
  }
  return url;
};

export default { stripBaseFromUrl, assureBaseUrl };
