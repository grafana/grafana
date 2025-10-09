import semver from 'semver';

import { COLOR_DEFAULTS, DISPLAY_NAMES } from '../../constants';

/**
 * Polishes version strings by removing build metadata and pre-release identifiers
 */
export function polishVersion(version: string): string {
  try {
    // Remove 'v' prefix if present for semver parsing
    const cleanVersion = version.startsWith('v') ? version.slice(1) : version;

    // Parse with semver to extract major.minor.patch
    const parsed = semver.parse(cleanVersion);
    if (parsed) {
      // Return only major.minor.patch, ignoring pre-release and build metadata
      return `v${parsed.major}.${parsed.minor}.${parsed.patch}`;
    }

    // Fallback: if semver parsing fails, try to extract just the version numbers
    const versionMatch = cleanVersion.match(/^(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      return `v${versionMatch[1]}`;
    }

    // If all else fails, return original version
    return version;
  } catch (error) {
    // If anything goes wrong, return the original version
    return version;
  }
}

/**
 * Gets the appropriate color for an extension type
 */
export function getExtensionTypeColor(
  extensionType: string,
  options: { linkExtensionColor?: string; componentExtensionColor?: string; functionExtensionColor?: string }
): string {
  switch (extensionType) {
    case 'component':
      return options.componentExtensionColor || COLOR_DEFAULTS.COMPONENT_EXTENSION;
    case 'function':
      return options.functionExtensionColor || COLOR_DEFAULTS.FUNCTION_EXTENSION;
    case 'link':
    default:
      return options.linkExtensionColor || COLOR_DEFAULTS.LINK_EXTENSION;
  }
}

/**
 * Gets the display name for a plugin ID
 */
export function getDisplayName(pluginId: string): string {
  if (pluginId === 'grafana-core') {
    return DISPLAY_NAMES.GRAFANA_CORE;
  }
  return pluginId;
}
