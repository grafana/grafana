import { PluginSignatureStatus } from './plugin';

/**
 * Utility function to check if a plugin is unsigned.
 *
 * @param signature - the plugin meta signature
 * @internal
 */
export function isUnsignedPluginSignature(signature?: PluginSignatureStatus) {
  return signature && signature !== PluginSignatureStatus.valid && signature !== PluginSignatureStatus.internal;
}
