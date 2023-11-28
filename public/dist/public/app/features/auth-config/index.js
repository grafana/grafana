import { __awaiter } from "tslib";
import { contextSrv } from 'app/core/core';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { AccessControlAction } from 'app/types';
export * from './types';
const registeredAuthProviders = [];
const authProvidersConfigHooks = {};
export function registerAuthProvider(provider, getConfigHook) {
    if (!registeredAuthProviders.find((p) => p.id === provider.id)) {
        registeredAuthProviders.push(provider);
        if (getConfigHook) {
            authProvidersConfigHooks[provider.id] = getConfigHook;
        }
    }
}
export function getRegisteredAuthProviders() {
    return registeredAuthProviders;
}
export function getAuthProviderInfo(provider) {
    return registeredAuthProviders.find((p) => p.id === provider);
}
export function getAuthProviders(cfg) {
    const providers = [];
    for (const [section, sectionConfig] of Object.entries(cfg)) {
        const provider = registeredAuthProviders.find((provider) => `auth.${provider.id}` === section);
        if (provider) {
            const providerData = Object.assign(Object.assign({}, sectionConfig), { providerId: provider.id, displayName: sectionConfig.name || provider.displayName });
            providers.push(providerData);
        }
    }
    return providers;
}
export function getAuthProviderStatus(providerId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (authProvidersConfigHooks[providerId]) {
            const getStatusHook = authProvidersConfigHooks[providerId];
            return getStatusHook();
        }
        return { configured: false, enabled: false };
    });
}
export function initAuthConfig() {
    const ldapAuthProvider = {
        id: 'ldap',
        type: 'LDAP',
        protocol: 'LDAP',
        displayName: 'LDAP',
        configPath: 'ldap',
    };
    registerAuthProvider(ldapAuthProvider, getConfigHookLDAP);
}
function getConfigHookLDAP() {
    return __awaiter(this, void 0, void 0, function* () {
        if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
            const result = yield getBackendSrv().get('/api/admin/settings');
            const ldapSettings = result['auth.ldap'] || {};
            return {
                configured: ldapSettings['enabled'] === 'true',
                enabled: ldapSettings['enabled'] === 'true',
                hide: ldapSettings['enabled'] !== 'true',
            };
        }
        return { configured: false, enabled: false };
    });
}
//# sourceMappingURL=index.js.map