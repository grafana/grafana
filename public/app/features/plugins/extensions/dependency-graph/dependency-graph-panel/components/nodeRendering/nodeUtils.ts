/**
 * Node Rendering Utilities
 *
 * Utility functions for node rendering in the dependency graph.
 */

import semver from 'semver';

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
    console.error('Error polishing version:', version, error);
    return version;
  }
}
