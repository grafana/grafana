/**
 * Utilities for integration versioning
 *
 * These utilities help get version-specific options from the backend response
 * (via /api/alert-notifiers?version=2)
 */

import { GrafanaManagedContactPoint } from 'app/plugins/datasource/alertmanager/types';

import { NotificationChannelOption, NotifierDTO } from '../types/alerting';

/**
 * Checks if a notifier can be used to create new integrations.
 * A notifier can be created if it has at least one version with canCreate: true,
 * or if it has no versions array (legacy behavior).
 *
 * @param notifier - The notifier DTO to check
 * @returns True if the notifier can be used to create new integrations
 */
export function canCreateNotifier(notifier: NotifierDTO): boolean {
  // If no versions array, assume it can be created (legacy behavior)
  if (!notifier.versions || notifier.versions.length === 0) {
    return true;
  }

  // Check if any version has canCreate: true (or undefined, which defaults to true)
  return notifier.versions.some((v) => v.canCreate !== false);
}

/**
 * Checks if a specific version is legacy (an old/deprecated version format).
 * A version is legacy if it is NOT the current version of the notifier.
 * For example, 'v0mimir1' is legacy when 'currentVersion' is 'v1'.
 *
 * @param notifier - The notifier DTO containing versions array and currentVersion
 * @param version - The version string to check (e.g., 'v0mimir1', 'v1')
 * @returns True if the version is not the current version
 */
export function isLegacyVersion(notifier: NotifierDTO, version?: string): boolean {
  // If no version specified or no currentVersion defined, it's not legacy
  if (!version || !notifier.currentVersion) {
    return false;
  }

  // A version is legacy if it's different from the current version
  return version !== notifier.currentVersion;
}

/**
 * Checks if a notifier or a specific version is deprecated.
 * A notifier is deprecated if either:
 * - The notifier itself has deprecated: true (top-level)
 * - The specific version has deprecated: true
 * - If no version specified, checks the currentVersion
 *
 * @param notifier - The notifier DTO to check
 * @param version - Optional version string to check for version-specific deprecation
 * @returns True if the notifier or version is deprecated
 */
export function isDeprecated(notifier: NotifierDTO, version?: string): boolean {
  // Check top-level deprecation first
  if (notifier.deprecated) {
    return true;
  }

  // Determine which version to check: provided version, currentVersion, or first version
  // Use empty string check since version might be '' instead of undefined
  const versionToCheck = (version && version.length > 0 ? version : null) || notifier.currentVersion;

  // Check if the version is deprecated
  if (versionToCheck && notifier.versions) {
    const versionData = notifier.versions.find((v) => v.version === versionToCheck);
    return versionData?.deprecated === true;
  }

  return false;
}

/**
 * Gets the options for a specific version of a notifier.
 * Used to display the correct form fields based on integration version.
 *
 * @param notifier - The notifier DTO containing versions array
 * @param version - The version to get options for (e.g., 'v0', 'v1')
 * @returns The options for the specified version, or default options if version not found
 */
export function getOptionsForVersion(notifier: NotifierDTO, version?: string): NotificationChannelOption[] {
  // If no versions array, use default options
  if (!notifier.versions || notifier.versions.length === 0) {
    return notifier.options;
  }

  // If version is specified, find the matching version
  if (version) {
    const versionData = notifier.versions.find((v) => v.version === version);
    // Return version-specific options if found, otherwise fall back to default
    return versionData?.options ?? notifier.options;
  }

  // If no version specified, find the default creatable version (canCreate !== false)
  const defaultVersion = notifier.versions.find((v) => v.canCreate !== false);
  return defaultVersion?.options ?? notifier.options;
}

/**
 * Checks if a contact point has any legacy (imported) integrations.
 * A contact point has legacy integrations if any of its integrations uses a version
 * with canCreate: false in the corresponding notifier's versions array.
 *
 * @param contactPoint - The contact point to check
 * @param notifiers - Array of notifier DTOs to look up version info
 * @returns True if the contact point has at least one legacy/imported integration
 */
export function hasLegacyIntegrations(contactPoint?: GrafanaManagedContactPoint, notifiers?: NotifierDTO[]): boolean {
  if (!contactPoint?.grafana_managed_receiver_configs || !notifiers) {
    return false;
  }

  return contactPoint.grafana_managed_receiver_configs.some((config) => {
    const notifier = notifiers.find((n) => n.type === config.type);
    return notifier ? isLegacyVersion(notifier, config.version) : false;
  });
}

/**
 * Gets a user-friendly label for a legacy version.
 * Extracts the version number from the version string and formats it as:
 * - "Legacy" for version 1 (e.g., v0mimir1)
 * - "Legacy v2" for version 2 (e.g., v0mimir2)
 * - etc.
 *
 * Precondition: This function assumes the version is already known to be legacy
 * (i.e., canCreate: false). Use isLegacyVersion() to check before calling this.
 *
 * @param version - The version string (e.g., 'v0mimir1', 'v0mimir2')
 * @returns A user-friendly label like "Legacy" or "Legacy v2"
 */
export function getLegacyVersionLabel(version?: string): string {
  if (!version) {
    return 'Legacy';
  }

  // Extract trailing number from version string (e.g., v0mimir1 → 1, v0mimir2 → 2)
  const match = version.match(/(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num === 1) {
      return 'Legacy';
    }
    return `Legacy v${num}`;
  }

  return 'Legacy';
}
