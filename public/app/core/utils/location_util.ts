import config from 'app/core/config';

// Slash encoding for angular location provider, see https://github.com/angular/angular.js/issues/10479
const SLASH = '<SLASH>';
export const decodePathComponent = (pc: string) => decodeURIComponent(pc).replace(new RegExp(SLASH, 'g'), '/');
export const encodePathComponent = (pc: string) => encodeURIComponent(pc.replace(/\//g, SLASH));

export const stripBaseFromUrl = url => {
  const appSubUrl = config.appSubUrl;
  const stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
  const urlWithoutBase =
    url.length > 0 && url.indexOf(appSubUrl) === 0 ? url.slice(appSubUrl.length - stripExtraChars) : url;

  return urlWithoutBase;
};

export default { stripBaseFromUrl };
