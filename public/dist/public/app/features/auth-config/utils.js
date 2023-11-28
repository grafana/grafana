import { BASE_PATH } from './constants';
export function getProviderUrl(provider) {
    return BASE_PATH + (provider.configPath || provider.id);
}
//# sourceMappingURL=utils.js.map