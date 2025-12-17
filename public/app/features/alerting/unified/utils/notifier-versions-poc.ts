/**
 * POC/Demo utilities for integration versioning
 *
 * This file simulates backend support for integration versioning
 * by creating legacy (v0) versions of selected integrations.
 *
 * In production, this data should come from the backend.
 */

import { NotifierDTO } from '../types/alerting';

import { canCreateVersion, getLatestVersion, isDeprecatedVersion } from './integration-versions';

/**
 * List of integration types that have legacy (mimir) versions
 * These are the ones that exist in both Grafana and Mimir alert managers
 */
const INTEGRATIONS_WITH_LEGACY_VERSIONS = ['slack', 'webhook', 'email', 'telegram', 'discord'];

/**
 * Version identifiers
 */
const MIMIR_VERSION = 'v0mimir1';
const GRAFANA_VERSION = getLatestVersion();

/**
 * Simulates backend response with versioned integrations
 * Creates Mimir (v0mimir1) versions for selected integrations
 *
 * @param notifiers - Original notifiers from the API
 * @returns Enriched notifiers array with legacy versions added
 */
export function enrichNotifiersWithVersionsPOC(notifiers: NotifierDTO[]): NotifierDTO[] {
  const result: NotifierDTO[] = [];

  notifiers.forEach((notifier) => {
    // Add the current version (v1 - Grafana)
    const grafanaVersion: NotifierDTO = {
      ...notifier,
      currentVersion: GRAFANA_VERSION,
    };
    result.push(grafanaVersion);

    // If this integration has a legacy version, create it
    if (INTEGRATIONS_WITH_LEGACY_VERSIONS.includes(notifier.type)) {
      const mimirVersion: NotifierDTO = {
        ...notifier,
        // Use a different type identifier for Mimir version
        // In real implementation, backend would provide this
        type: `${notifier.type}_${MIMIR_VERSION}` as any,
        name: notifier.name, // Keep same name for grouping
        description: `${notifier.description} (Mimir version)`,
        currentVersion: MIMIR_VERSION,
      };
      result.push(mimirVersion);
    }
  });

  return result;
}

/**
 * Groups notifiers by their base name (without version suffix)
 * Used for displaying only the latest version in dropdowns
 */
export function groupNotifiersByName(notifiers: NotifierDTO[]): Record<string, NotifierDTO[]> {
  return notifiers.reduce((acc, notifier) => {
    const baseName = notifier.name;
    if (!acc[baseName]) {
      acc[baseName] = [];
    }
    acc[baseName].push(notifier);
    return acc;
  }, {} as Record<string, NotifierDTO[]>);
}

/**
 * Filters notifiers based on context (creating vs editing)
 *
 * @param notifiers - All available notifiers
 * @param isEditing - Whether we're in edit mode
 * @returns Filtered notifiers
 */
export function filterNotifiersForContext(notifiers: NotifierDTO[], isEditing: boolean): NotifierDTO[] {
  if (isEditing) {
    // In edit mode, show all versions (including legacy)
    return notifiers;
  } else {
    // In create mode, only show versions that can be created
    return notifiers.filter((notifier) => canCreateVersion(notifier.currentVersion));
  }
}

/**
 * Gets the latest (non-deprecated) version of each integration
 * Used for dropdown display when creating new integrations
 */
export function getLatestVersions(notifiers: NotifierDTO[]): NotifierDTO[] {
  const grouped = groupNotifiersByName(notifiers);
  const latest: NotifierDTO[] = [];

  Object.values(grouped).forEach((versions) => {
    // Sort by version descending (v1, v0, etc.) and take the first non-deprecated
    const sorted = versions.sort((a, b) => {
      const versionA = a.currentVersion || 'v1';
      const versionB = b.currentVersion || 'v1';
      return versionB.localeCompare(versionA);
    });

    // Find first non-deprecated version, or fallback to first
    const latestVersion = sorted.find((v) => !isDeprecatedVersion(v.currentVersion)) || sorted[0];
    
    // Only include if it can be created
    if (canCreateVersion(latestVersion.currentVersion)) {
      latest.push(latestVersion);
    }
  });

  return latest;
}
