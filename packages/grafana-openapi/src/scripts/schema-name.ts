/**
 * Reverse RFC 6901 JSON Pointer escaping ('~1' -> '/', '~0' -> '~').
 * kube-openapi escapes schema names containing a raw Go import path (which
 * contain '/') before using them as both the components.schemas key and the
 * $ref target, so this must be undone before the name can be parsed.
 */
export function unescapeJsonPointer(name: string) {
  return name.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Apply RFC 6901 JSON Pointer escaping ('~' -> '~0', '/' -> '~1'). Used to embed a
 * plain schema name (the components.schemas key) inside a $ref pointer string,
 * where a literal '/' would otherwise be read as a path separator.
 */
export function escapeJsonPointer(name: string) {
  return name.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Simplify a schema name by removing the version prefix if present.
 * For example, 'io.k8s.apimachinery.pkg.apis.meta.v1.Time' becomes 'Time'.
 * Unescaped first since kube-openapi may hand us the JSON-Pointer-escaped
 * form of a name that contains a raw Go import path (e.g.
 * 'github.com~1grafana~1grafana~1pkg~1apis~1iam~1v0alpha1.TeamMemberList');
 * without this, the schema key and the $ref pointing to it end up escaped
 * differently and fail to resolve.
 */
export function simplifySchemaName(schemaName: string) {
  const name = unescapeJsonPointer(schemaName);
  const parts = name.split('.');

  const versionIndex = parts.findIndex((part) => VERSION_REGEX.test(part));

  if (versionIndex !== -1 && versionIndex + 1 < parts.length) {
    return parts.slice(versionIndex + 1).join('.');
  } else {
    return name;
  }
}

// Matches version segments like 'v1', 'v1beta1', 'v0alpha1'.
const VERSION_REGEX = /^v\d+[a-zA-Z0-9]*$/;

/** The path segments in front of the version. Empty for a name with no version segment. */
function packageSegments(schemaName: string) {
  const segments = unescapeJsonPointer(schemaName).split(/[./]/);
  const versionIndex = segments.findIndex((segment) => VERSION_REGEX.test(segment));
  return versionIndex > 0 ? segments.slice(0, versionIndex) : [];
}

function pascalCase(text: string) {
  return text
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
}

/** Whether the schema comes from a Grafana repository rather than a third party. */
function isGrafanaPath(schemaName: string) {
  const name = unescapeJsonPointer(schemaName);
  return name.startsWith('com.github.grafana.') || name.startsWith('github.com/grafana/');
}

/**
 * Whether the schema belongs to the group the document describes, rather than being
 * imported. Only the group's own label counts: 'alerting' is in the path of every
 * alerting group, so a shared label would make a sibling's import look local. The label
 * can sit anywhere in the path, since the two do not line up exactly -
 * 'correlations.grafana.app' is served from a package called 'correlation'.
 */
function belongsToGroup(schemaName: string, group: string) {
  const label = group.split('.')[0].toLowerCase();
  return packageSegments(schemaName).some((segment) => segment.toLowerCase() === label);
}

/**
 * A distinct name for a schema that cannot keep its simplified one. Grafana schemas take
 * their package as a prefix; a hand-registered short name has no package to borrow from,
 * so it takes the group. Third-party names spell out the whole path, because one segment
 * of theirs says little.
 */
function qualifySchemaName(schemaKey: string, group: string | undefined) {
  const base = simplifySchemaName(schemaKey);
  const segments = packageSegments(schemaKey);

  if (segments.length > 0) {
    return isGrafanaPath(schemaKey)
      ? pascalCase(segments[segments.length - 1]) + base
      : pascalCase(unescapeJsonPointer(schemaKey).replace(/\//g, '.'));
  }

  return group ? pascalCase(group.split('.')[0]) + base : base;
}

/**
 * Which schema keeps the plain name when two simplify to the same one. An imported
 * schema wins, so a type published to several groups is named the same in each of their
 * clients, and a name we cannot qualify wins over one we can.
 */
function plainNamePriority(schemaKey: string, group: string | undefined) {
  if (packageSegments(schemaKey).length === 0) {
    return group ? 1 : 0;
  }
  return group && belongsToGroup(schemaKey, group) ? 1 : 0;
}

/**
 * Map each schema key in a document to the name it is published under. Only a key that
 * would land on a name another key already has gets a qualified one, so enrolling a
 * group in a shared API renames the clash and nothing else.
 *
 * The result depends on the set of keys and the group, never on the order they arrive
 * in, so reordering the document cannot move a name from one type to another.
 *
 * @param group the API group the document describes, e.g. 'dashboard.grafana.app'
 */
export function buildSchemaNameMap(schemaKeys: string[], group?: string) {
  // Code-unit order, so the result cannot vary by locale.
  const ordered = [...schemaKeys].sort(
    (a, b) => plainNamePriority(a, group) - plainNamePriority(b, group) || (a < b ? -1 : a > b ? 1 : 0)
  );

  const names = new Map<string, string>();
  const taken = new Set<string>();

  for (const schemaKey of ordered) {
    let name = simplifySchemaName(schemaKey);

    if (taken.has(name)) {
      name = qualifySchemaName(schemaKey, group);
      // Not reachable with today's documents, but a name must be unique regardless.
      for (let suffix = 2; taken.has(name); suffix++) {
        name = qualifySchemaName(schemaKey, group) + suffix;
      }
    }

    taken.add(name);
    names.set(schemaKey, name);
  }

  return names;
}
