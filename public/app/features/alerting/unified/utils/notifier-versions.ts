/**
 * POC/Demo utilities for integration versioning
 *
 * This file simulates backend support for integration versioning
 * by creating legacy (v0) versions of selected integrations.
 *
 * In production, this data should come from the backend.
 */

import { NotifierDTO } from '../types/alerting';

import { canCreateVersion, isDeprecatedVersion } from './integration-versions';

/**
 * Version identifiers
 */
const MIMIR_VERSION = 'v0';
const GRAFANA_VERSION = 'v1';

/**
 * Simulates backend response with versioned integrations
 * Creates a single Slack v0 integration for testing purposes
 *
 * @param notifiers - Original notifiers from the API
 * @returns Enriched notifiers array with v1 versions and one Slack v0
 */
export function enrichNotifiersWithVersionsPOC(notifiers: NotifierDTO[]): Array<NotifierDTO<string>> {
  const result: Array<NotifierDTO<string>> = [];

  notifiers.forEach((notifier) => {
    // Add the current version (v1 - Grafana) for all integrations
    const grafanaVersion: NotifierDTO<string> = {
      ...notifier,
      currentVersion: GRAFANA_VERSION,
    };
    result.push(grafanaVersion);

    // Only add a v0 version for Slack to test legacy integration behavior
    if (notifier.type === 'slack') {
      const mimirVersion: NotifierDTO<string> = {
        ...notifier,
        // Use a synthetic type identifier to distinguish v0 from v1 in the dropdown
        // When saving, the actual contact point will use type: "slack" with version: "v0"
        type: `${notifier.type}_${MIMIR_VERSION}`,
        name: notifier.name,
        description: `${notifier.description} (Legacy version)`,
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
function groupNotifiersByName(notifiers: Array<NotifierDTO<string>>): Record<string, Array<NotifierDTO<string>>> {
  return notifiers.reduce<Record<string, Array<NotifierDTO<string>>>>((acc, notifier) => {
    const baseName = notifier.name;
    if (!acc[baseName]) {
      acc[baseName] = [];
    }
    acc[baseName].push(notifier);
    return acc;
  }, {});
}

/**
 * Gets the latest (non-deprecated) version of each integration
 * Used for dropdown display when creating new integrations
 */
export function getLatestVersions(notifiers: Array<NotifierDTO<string>>): Array<NotifierDTO<string>> {
  const grouped = groupNotifiersByName(notifiers);
  const latest: Array<NotifierDTO<string>> = [];

  Object.values(grouped).forEach((versions) => {
    // Sort by version descending (v1 > v0)
    const sorted = versions.sort((a, b) => {
      const versionA = a.currentVersion || 'v1';
      const versionB = b.currentVersion || 'v1';
      // Simple string comparison for version strings (v1, v0, etc.)
      if (versionB > versionA) {
        return 1;
      }
      if (versionB < versionA) {
        return -1;
      }
      return 0;
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
