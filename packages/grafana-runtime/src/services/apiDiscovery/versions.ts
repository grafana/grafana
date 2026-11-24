import { type ApiGroupInfo } from './types';

// The Kubernetes version format: v<major>, optionally followed by alpha<minor> or beta<minor>.
const VERSION_PATTERN = /^v(\d+)(?:(alpha|beta)(\d+))?$/;
function parseVersion(version: string) {
  const match = VERSION_PATTERN.exec(version);
  if (!match) {
    return undefined;
  }
  const [, major, level, minor] = match;
  const stability = level === 'alpha' ? 0 : level === 'beta' ? 1 : 2;
  return { stability, major: Number(major), minor: Number(minor ?? 0) };
}

/**
 * Sorts versions from most to least stable, the way Kubernetes ranks them: GA before beta before
 * alpha, then the higher version first. Versions that don't follow that format go last, alphabetically.
 */
export function compareApiVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  if (!parsedA || !parsedB) {
    if (parsedA) {
      return -1;
    }
    if (parsedB) {
      return 1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  }

  return parsedB.stability - parsedA.stability || parsedB.major - parsedA.major || parsedB.minor - parsedA.minor;
}

/**
 * The server's preferred version if the caller supports it, otherwise the most stable version both
 * support. Never a version the caller did not list.
 */
export function selectApiVersion(group: ApiGroupInfo, supported: readonly string[]): string | undefined {
  if (supported.includes(group.preferredVersion)) {
    return group.preferredVersion;
  }
  return group.versions.filter((version) => supported.includes(version)).sort(compareApiVersions)[0];
}
