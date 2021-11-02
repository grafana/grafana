import { PluginSignatureStatus } from './plugin';
/**
 * Utility function to check if a plugin is unsigned.
 *
 * @param signature - the plugin meta signature
 * @internal
 */
export function isUnsignedPluginSignature(signature) {
    return signature && signature !== PluginSignatureStatus.valid && signature !== PluginSignatureStatus.internal;
}
//# sourceMappingURL=pluginSignature.js.map