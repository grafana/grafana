import { Range } from 'semver';

/**
 * Formats a semver range string (e.g. ">= 8.5.20 < 9 || >= 9.1.0")
 * into a human-readable string (e.g. "8.5.20 – 9.0.0, 9.1.0 or later").
 */
export function formatGrafanaDependency(dependency: string | null): string {
  if (!dependency) {
    return 'N/A';
  }

  try {
    const range = new Range(dependency);
    const parts: string[] = [];

    for (const comparators of range.set) {
      const lowerBound = comparators.find((c) => c.operator === '>=');
      const upperBound = comparators.find((c) => c.operator === '<');

      if (lowerBound && upperBound) {
        const from = formatVersion(lowerBound.semver.major, lowerBound.semver.minor, lowerBound.semver.patch);
        const to = formatVersion(upperBound.semver.major, upperBound.semver.minor, upperBound.semver.patch);
        parts.push(`${from} – ${to}`);
      } else if (lowerBound) {
        const from = formatVersion(lowerBound.semver.major, lowerBound.semver.minor, lowerBound.semver.patch);
        parts.push(`${from} or later`);
      } else {
        return dependency;
      }
    }

    return parts.join(', ');
  } catch {
    return dependency;
  }
}

function formatVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}
