/**
 * Utilities for integration versioning
 *
 * These utilities help get version-specific options from the backend response
 * (via /api/alert-notifiers?version=2)
 */

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
 * Checks if a specific version is legacy (cannot be created).
 * A version is legacy if it has canCreate: false in the notifier's versions array.
 *
 * @param notifier - The notifier DTO containing versions array
 * @param version - The version string to check (e.g., 'v0mimir1', 'v1')
 * @returns True if the version is legacy (canCreate: false)
 */
export function isLegacyVersion(notifier: NotifierDTO, version?: string): boolean {
  // If no version specified or no versions array, it's not legacy
  if (!version || !notifier.versions || notifier.versions.length === 0) {
    return false;
  }

  // Find the matching version and check its canCreate property
  const versionData = notifier.versions.find((v) => v.version === version);

  // A version is legacy if canCreate is explicitly false
  return versionData?.canCreate === false;
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
  // If no version specified or no versions array, use default options
  if (!version || !notifier.versions || notifier.versions.length === 0) {
    return notifier.options;
  }

  // Find the matching version
  const versionData = notifier.versions.find((v) => v.version === version);

  // Return version-specific options if found, otherwise fall back to default
  return versionData?.options ?? notifier.options;
}
