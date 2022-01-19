import config from '../../core/config';

// addAccessControlQueryParam appends ?accesscontrol=true to a url when accesscontrol is enabled
export function addAccessControlQueryParam(params: Record<string, any>): Record<string, any> {
  if (!config.featureToggles['accesscontrol']) {
    return params;
  }
  return { ...params, accesscontrol: true };
}
