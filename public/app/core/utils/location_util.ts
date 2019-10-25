import config from 'app/core/config';

export const stripBaseFromUrl = (url: string): string => {
  const appSubUrl = config.appSubUrl;
  const stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
  const urlWithoutBase =
    url.length > 0 && url.indexOf(appSubUrl) === 0 ? url.slice(appSubUrl.length - stripExtraChars) : url;

  return urlWithoutBase;
};

export default { stripBaseFromUrl };
