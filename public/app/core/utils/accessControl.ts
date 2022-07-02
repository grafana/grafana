import config from '../../core/config';

// accessControlQueryParam adds an additional accesscontrol=true param to params when accesscontrol is enabled
export function accessControlQueryParam(params = {}) {
  if (!config.rbacEnabled) {
    return params;
  }
  return { ...params, accesscontrol: true };
}
