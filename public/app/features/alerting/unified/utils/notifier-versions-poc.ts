/**
 * POC/Demo utilities for integration versioning
 *
 * This file simulates backend support for integration versioning
 * by creating legacy (v0) versions of selected integrations.
 *
 * In production, this data should come from the backend.
 */

import { NotifierDTO } from '../types/alerting';

/**
 * List of integration types that have legacy (mimir) versions
 * These are the ones that exist in both Grafana and Mimir alert managers
 */
const INTEGRATIONS_WITH_LEGACY_VERSIONS = ['slack', 'webhook', 'email', 'telegram', 'discord'];

/**
 * Version naming per decision doc:
 * - v1: Grafana integrations (current)
 * - v0mimir1: Mimir integrations (legacy)
 * - v0mimir2: Mimir msteamsv2 integration (if needed)
 */
const MIMIR_VERSION = 'v0mimir1';
const GRAFANA_VERSION = 'v1';

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
      version: GRAFANA_VERSION,
      deprecated: false,
      canCreate: true,
    };
    result.push(grafanaVersion);

    // If this integration has a legacy version, create it
    if (INTEGRATIONS_WITH_LEGACY_VERSIONS.includes(notifier.type)) {
      const mimirVersion: NotifierDTO = {
        ...notifier,
        // Use a different type identifier for Mimir version
        // In real implementation, backend would provide this
        type: `${notifier.type}_v0mimir1` as any,
        name: notifier.name, // Keep same name for grouping
        description: `${notifier.description} (Mimir version)`,
        version: MIMIR_VERSION,
        deprecated: true,
        canCreate: false, // Cannot create new instances of Mimir versions
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
    return notifiers.filter((notifier) => notifier.canCreate !== false);
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
      const versionA = a.version || 'v0';
      const versionB = b.version || 'v0';
      return versionB.localeCompare(versionA);
    });

    const latestVersion = sorted.find((v) => !v.deprecated) || sorted[0];
    if (latestVersion.canCreate !== false) {
      latest.push(latestVersion);
    }
  });

  return latest;
}
