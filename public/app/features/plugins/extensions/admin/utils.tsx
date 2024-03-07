import { PluginExtensionConfig, PluginExtensionPoints } from '@grafana/data';

import { PluginExtensionRegistry } from '../types';

import { ExtensionPointConfig } from './types';

// Gets persisted settings for an extension point
export function getExtensionPointSettings(extensionPointId: string) {}

// Updates settings for an extension point and persists them
export function setExtensionPointSettings(extensionPointId: string) {}

// Gets persisted settings for an extension
export function getExtensionSettings(id: string) {}

// Updates settings for an extension and persists them
export function setExtensionSettings(id: string) {}

// Gets settings for a plugin that registers extensions. (These settings are only about the plugins extensions)
export function getPluginSettings() {}

// Updates settings for a plugin that registers extensions. (These settings are only about the plugins extensions)
export function setPluginSettings() {}

// Gets settings for a plugin capability
export function getCapabilitySettings() {}

// Updates settings for a plugin capability
export function setCapabilitySettings() {}

// Gets the extensions that I have registered using the extensions explore tool
export function getMyExtensions() {}

// Update the extensions that I have registered using the extensions explore tool
export function setMyExtensions() {}

// Gets the capabilities that I have registered using the extensions explore tool
export function getMyCapabilities() {}

// Update the capabilities that I have registered using the extensions explore tool
export function setMyCapabilities() {}

// Gets the repl for the current user (the content of the REPL)
export function getRepl() {}

// Update the repl for the current user (the content of the REPL)
export function setRepl() {}

// This one is used to generate a unique id for a plugin extension
// (We don't yet have a way to have unique ids for plugin extensions (TODO - explain why))
export async function generateSHA256Hash(str: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

export async function generateIdForExtension(extension: PluginExtensionConfig) {}

export async function generateIdForCapability(extension: PluginExtensionConfig) {}

export function getCoreExtensionPoints(regsitry?: PluginExtensionRegistry): ExtensionPointConfig[] {
  const availableIds = Object.values(PluginExtensionPoints);
  const coreExtensionPoints = availableIds.map((id) => ({
    id,
    extensions: regsitry?.[id] || [],
  }));

  return coreExtensionPoints;
}

export function getPluginExtensionPoints(regsitry?: PluginExtensionRegistry): ExtensionPointConfig[] {
  if (!regsitry) {
    return [];
  }

  return Object.keys(regsitry)
    .filter((key) => key.startsWith('plugins/'))
    .map((key) => ({
      id: key,
      extensions: regsitry[key],
    }));
}
