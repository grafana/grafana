import config from '../../core/config';

// addAccessControlQueryParam appends ?accesscontrol=true to a url when accesscontrol is enabled
export function addAccessControlQueryParam(url: string): string {
  if (!config.featureToggles['accesscontrol']) {
    return url;
  }
  return url + '?accesscontrol=true';
}
