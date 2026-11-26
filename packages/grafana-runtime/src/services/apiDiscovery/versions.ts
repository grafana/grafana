import { type APIGroupInfo } from './types';

// A Kubernetes API version, such as v1, v2beta1 or v0alpha1.
const API_VERSION_PATTERN = /^v(?<major>\d+)(?:(?<level>alpha|beta)(?<minor>\d+))?$/;

export function isAPIVersion(version: string): boolean {
  return API_VERSION_PATTERN.test(version);
}

function parseVersion(version: string) {
  const groups = API_VERSION_PATTERN.exec(version)?.groups;
  if (!groups) {
    return undefined;
  }
  const { major, level, minor } = groups;
  const stability = level === 'alpha' ? 0 : level === 'beta' ? 1 : 2;
  return { stability, major: Number(major), minor: Number(minor ?? 0) };
}

/**
 * Sorts versions from most to least stable, the way Kubernetes ranks them: GA before beta before
 * alpha, then the higher version first. Versions that don't follow that format go last, alphabetically.
 */
export function compareAPIVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  if (parsedA && parsedB) {
    return parsedB.stability - parsedA.stability || parsedB.major - parsedA.major || parsedB.minor - parsedA.minor;
  }
  if (parsedA) {
    return -1;
  }
  if (parsedB) {
    return 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The server's preferred version if the caller supports it, otherwise the most stable version both
 * support. Never a version the caller did not list.
 */
export function selectAPIVersion<V extends string>(group: APIGroupInfo, supported: readonly V[]): V | undefined {
  const common = supported.filter((version) => group.versions.includes(version));
  return common.find((version) => version === group.preferredVersion) ?? common.sort(compareAPIVersions)[0];
}
