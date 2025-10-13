// accessControlQueryParam adds an additional accesscontrol=true param to params when accesscontrol is enabled
export function accessControlQueryParam(params = {}) {
  return { ...params, accesscontrol: true };
}
