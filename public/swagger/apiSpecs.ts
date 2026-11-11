export interface APISpec {
  // Identifies the spec in the ?api= query parameter.
  key: string;
  label: string;
  url: string;
  // Set only when the picker should show this spec under a group header, which
  // is when its API group has more than one version.
  group?: string;
  version?: string;
  // The version the API server reports as preferred, when its group has more than one.
  preferred?: boolean;
  // An alpha or beta version in a group that also has a stable version.
  superseded?: boolean;
}

// The subset of a Kubernetes APIGroupList (GET /apis) used here.
export interface APIGroupList {
  groups?: Array<{ name: string; preferredVersion?: { version: string } }>;
}

export const grafanaGroup = 'Grafana';

const builtinSpecs: APISpec[] = [
  { key: 'openapi2', label: 'Grafana API (OpenAPI v2)', url: 'public/api-merged.json', group: grafanaGroup },
  { key: 'openapi3', label: 'Grafana API (OpenAPI v3)', url: 'public/openapi3.json', group: grafanaGroup },
];

const versionPattern = /^v(\d+)(?:(alpha|beta)(\d+))?$/;
const stabilityRank = { alpha: 0, beta: 1, stable: 2 };

function parseVersion(version: string) {
  const match = versionPattern.exec(version);
  if (!match) {
    return undefined;
  }
  const stability: keyof typeof stabilityRank = match[2] === 'alpha' || match[2] === 'beta' ? match[2] : 'stable';
  return { major: Number(match[1]), stability, minor: Number(match[3] ?? 0) };
}

// compareVersions orders versions the way Kubernetes prioritizes them: stable
// before beta before alpha, newer before older within each. Versions that don't
// follow the Kubernetes naming come last, sorted by name.
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) {
    if (pa) {
      return -1;
    }
    if (pb) {
      return 1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return stabilityRank[pb.stability] - stabilityRank[pa.stability] || pb.major - pa.major || pb.minor - pa.minor;
}

type OpenAPIPaths = Record<string, { serverRelativeURL: string }>;

// loadSpecs lists the specs the picker offers. Either request can fail, for
// example on a standalone swagger-server without a proxy, and the builtin
// Grafana specs, which are static files, must still be listed.
export async function loadSpecs(): Promise<APISpec[]> {
  const [openapi, groupList] = await Promise.all([
    fetchJSON<{ paths?: OpenAPIPaths }>('openapi/v3'),
    fetchJSON<APIGroupList>('apis'),
  ]);
  return buildSpecs(openapi?.paths ?? {}, groupList);
}

async function fetchJSON<T>(url: string): Promise<T | undefined> {
  try {
    const rsp = await fetch(url);
    return rsp.ok ? await rsp.json() : undefined;
  } catch {
    return undefined;
  }
}

// buildSpecs lists the Grafana API specs followed by one spec per API group
// version, sorted by API group and by version priority within each group.
// Combobox moves all options without a group into one block, so single-version
// groups are shown together rather than in this order. paths is the index
// served at /openapi/v3.
export function buildSpecs(paths: OpenAPIPaths, groupList?: APIGroupList): APISpec[] {
  const preferred = new Map(groupList?.groups?.map((g) => [g.name, g.preferredVersion?.version]));

  const versionsByGroup = new Map<string, Array<{ version: string; url: string }>>();
  for (const [key, val] of Object.entries(paths)) {
    const parts = key.split('/');
    if (parts.length !== 3) {
      continue;
    }
    const [, group, version] = parts;
    const versions = versionsByGroup.get(group) ?? [];
    versions.push({ version, url: val.serverRelativeURL.substring(1) }); // remove initial slash
    versionsByGroup.set(group, versions);
  }

  const specs = [...builtinSpecs];
  for (const group of [...versionsByGroup.keys()].sort()) {
    const versions = versionsByGroup.get(group)!.sort((a, b) => compareVersions(a.version, b.version));
    const multiple = versions.length > 1;
    const hasStable = versions.some((v) => parseVersion(v.version)?.stability === 'stable');

    for (const { version, url } of versions) {
      specs.push({
        key: `${group}-${version}`,
        label: `${group}/${version}`,
        url,
        group: multiple ? group : undefined,
        version,
        preferred: multiple && preferred.get(group) === version,
        superseded: hasStable && parseVersion(version)?.stability !== 'stable',
      });
    }
  }
  return specs;
}
