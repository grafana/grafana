import { type OpenAPIV3 } from 'openapi-types';

import { buildSchemaNameMap, escapeJsonPointer, simplifySchemaName } from './schema-name.ts';

/**
 * Process an OpenAPI spec to remove k8s metadata from names and paths:
 * - Remove the prefix: "/apis/<group>/<version>/namespaces/{namespace}" from paths.
 *   Paths without it (cluster-scoped kinds, version-level routes, discovery) stay absolute.
 * - Filter out `namespace` from path parameters.
 * - Update all $ref fields to remove k8s metadata from schema names.
 * - Simplify schema names in "components.schemas".
 */
export function processOpenAPISpec(spec: OpenAPIV3.Document) {
  // Create a deep copy of the spec to avoid mutating the original
  const newSpec = JSON.parse(JSON.stringify(spec));

  // Decided up front because the paths are rewritten before the schemas are, and a $ref
  // has to end up with the same name as the schema it points at.
  const schemaNames = buildSchemaNameMap(Object.keys(newSpec.components.schemas), specGroupVersion(newSpec)?.group);

  // Process 'paths' property
  const newPaths: Record<string, unknown> = {};
  for (const [path, pathItem] of Object.entries<OpenAPIV3.PathItemObject>(newSpec.paths)) {
    // Remove empty path items
    if (!pathItem) {
      continue;
    }
    // Remove the specified part from the path key
    const newPathKey = path.replace(/^\/apis\/[^/]+\/[^/]+\/namespaces\/\{namespace}/, '');

    // Process each method in the path (e.g., get, post)
    const newPathItem: Record<string, unknown> = {};

    // Filter out namespace parameter at path level
    if (Array.isArray(pathItem.parameters)) {
      pathItem.parameters = filterNamespaceParameters(pathItem.parameters);
    }

    for (const method of Object.keys(pathItem)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const operation = pathItem[method as keyof OpenAPIV3.PathItemObject];

      // Filter out namespace parameter at operation level
      if (
        operation &&
        typeof operation === 'object' &&
        'parameters' in operation &&
        Array.isArray(operation.parameters)
      ) {
        operation.parameters = filterNamespaceParameters(operation.parameters);
      }

      updateRefs(operation, schemaNames);

      newPathItem[method] = operation;
    }

    newPaths[newPathKey] = newPathItem;
  }
  newSpec.paths = newPaths;

  // Process 'components.schemas', i.e., type definitions
  // Kept in their original order, so a naming change shows up in a diff on its own.
  const newSchemas: Record<string, unknown> = {};
  for (const schemaKey of Object.keys(newSpec.components.schemas)) {
    const schemaObject = newSpec.components.schemas[schemaKey];
    updateRefs(schemaObject, schemaNames);

    newSchemas[schemaNames.get(schemaKey) ?? simplifySchemaName(schemaKey)] = schemaObject;
  }
  newSpec.components.schemas = newSchemas;

  return newSpec;
}

/**
 * Filter out namespace parameters from an array of parameters
 */
function filterNamespaceParameters(parameters: Array<OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject>) {
  return parameters.filter((param) => 'name' in param && param.name !== 'namespace');
}

/**
 * The group and version the document describes, taken from a path since that is where they
 * appear literally. `info.title` is the fallback, and is not always a group - the quotas
 * document calls itself 'Grafana API Server'.
 */
export function specGroupVersion(spec: OpenAPIV3.Document): { group: string; version: string } | undefined {
  for (const path of Object.keys(spec.paths ?? {})) {
    const match = path.match(/^\/apis\/([^/]+)\/([^/]+)\//);
    if (match) {
      return { group: match[1], version: match[2] };
    }
  }

  const title = spec.info?.title ?? '';
  if (/^\S+\/v\S*$/.test(title)) {
    const [group, version] = title.split('/');
    return { group, version };
  }
  return undefined;
}

/**
 * Recursively update all $ref fields to remove k8s metadata from names
 */
function updateRefs(obj: unknown, schemaNames: Map<string, string>) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      updateRefs(item, schemaNames);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    if ('$ref' in obj && typeof obj.$ref === 'string') {
      const refParts = obj.$ref.split('/');
      const lastRefPart = refParts[refParts.length - 1];
      // A ref to a schema the document does not define keeps the old behaviour, since
      // there is no published name to look up.
      const newRefName = schemaNames.get(lastRefPart) ?? simplifySchemaName(lastRefPart);
      // The components.schemas key is the plain (unescaped) name, but a '/' inside
      // a $ref token is always a JSON Pointer path separator, so it must be
      // re-escaped here or the ref won't resolve back to that key.
      obj.$ref = `#/components/schemas/${escapeJsonPointer(newRefName)}`;
    }
    for (const key in obj) {
      if (key !== '$ref') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        updateRefs(obj[key as keyof typeof obj], schemaNames);
      }
    }
  }
}
