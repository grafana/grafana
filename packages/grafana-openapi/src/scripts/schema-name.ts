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

  // Regex to match version segments like 'v1', 'v1beta1', 'v0alpha1', etc.
  const versionRegex = /^v\d+[a-zA-Z0-9]*$/;
  const versionIndex = parts.findIndex((part) => versionRegex.test(part));

  if (versionIndex !== -1 && versionIndex + 1 < parts.length) {
    return parts.slice(versionIndex + 1).join('.');
  } else {
    return name;
  }
}
