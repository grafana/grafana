/**
 * Check if an integration version is deprecated/legacy
 * Any version starting with "v0" is considered legacy/deprecated
 */
export function isDeprecatedVersion(currentVersion?: string): boolean {
  return currentVersion?.startsWith('v0') ?? false;
}

/**
 * Check if new instances of this version can be created
 * Only non-v0 versions can be created
 */
export function canCreateVersion(currentVersion?: string): boolean {
  return !isDeprecatedVersion(currentVersion);
}
