/**
 * Integration Versioning Utilities
 *
 * Centralized logic for handling integration versions during
 * Single Alert Manager migration from Mimir to Grafana.
 */

/**
 * Version metadata for each known integration version
 */
export const VERSION_INFO = {
  v0mimir1: {
    deprecated: true,
    canCreate: false,
    label: 'Mimir (Legacy)',
    description: 'Imported from Mimir Alert Manager',
  },
  v0mimir2: {
    deprecated: true,
    canCreate: false,
    label: 'Mimir MSTeams v2',
    description: 'Mimir-specific MSTeams integration',
  },
  v1: {
    deprecated: false,
    canCreate: true,
    label: 'Grafana',
    description: 'Current Grafana Alert Manager version',
  },
} as const;

export type IntegrationVersion = keyof typeof VERSION_INFO;

/**
 * Get metadata for a given integration version
 */
export function getVersionInfo(currentVersion?: string) {
  // Default to v1 (current Grafana) if no version specified
  if (!currentVersion) {
    return VERSION_INFO.v1;
  }

  // Return known version info or default
  return VERSION_INFO[currentVersion as IntegrationVersion] || VERSION_INFO.v1;
}

/**
 * Check if an integration version is deprecated/legacy
 */
export function isDeprecatedVersion(currentVersion?: string): boolean {
  return getVersionInfo(currentVersion).deprecated;
}

/**
 * Check if new instances of this version can be created
 */
export function canCreateVersion(currentVersion?: string): boolean {
  return getVersionInfo(currentVersion).canCreate;
}

/**
 * Check if a version is a Mimir/legacy version
 */
export function isMimirVersion(currentVersion?: string): boolean {
  return currentVersion?.startsWith('v0mimir') ?? false;
}

/**
 * Get the latest (creatable) version identifier
 */
export function getLatestVersion(): IntegrationVersion {
  return 'v1';
}

/**
 * Compare versions to determine which is newer
 * Returns: positive if a > b, negative if a < b, 0 if equal
 */
export function compareVersions(a?: string, b?: string): number {
  const versionA = a || 'v1';
  const versionB = b || 'v1';
  
  // Simple string comparison works for our version scheme
  // v1 > v0mimir2 > v0mimir1
  return versionB.localeCompare(versionA);
}

