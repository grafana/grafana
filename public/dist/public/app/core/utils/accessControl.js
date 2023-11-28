// accessControlQueryParam adds an additional accesscontrol=true param to params when accesscontrol is enabled
export function accessControlQueryParam(params = {}) {
    return Object.assign(Object.assign({}, params), { accesscontrol: true });
}
//# sourceMappingURL=accessControl.js.map