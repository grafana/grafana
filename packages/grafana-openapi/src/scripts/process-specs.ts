import fs from 'fs';
import { type OpenAPIV3 } from 'openapi-types';
import path from 'path';

import { buildSchemaNameMap, escapeJsonPointer, simplifySchemaName } from './schema-name.ts';

/**
 * Process an OpenAPI spec to remove k8s metadata from names and paths:
 * - Remove paths containing "/watch/" as they're deprecated.
 * - Remove 'ForAllNamespaces' endpoints
 * - Remove the prefix: "/apis/<group>/<version>/namespaces/{namespace}" from paths.
 * - Filter out `namespace` from path parameters.
 * - Update all $ref fields to remove k8s metadata from schema names.
 * - Simplify schema names in "components.schemas".
 */
function processOpenAPISpec(spec: OpenAPIV3.Document) {
  // Create a deep copy of the spec to avoid mutating the original
  const newSpec = JSON.parse(JSON.stringify(spec));

  // Names are decided up front because the paths are rewritten before the schemas are,
  // and a $ref has to end up with the same name as the schema it points at.
  const schemaNames = buildSchemaNameMap(Object.keys(newSpec.components.schemas), specGroup(newSpec));

  // Process 'paths' property
  const newPaths: Record<string, unknown> = {};
  for (const [path, pathItem] of Object.entries<OpenAPIV3.PathItemObject>(newSpec.paths)) {
    // Remove empty path items
    if (!pathItem) {
      continue;
    }
    // Remove the specified part from the path key
    const newPathKey = path.replace(/^\/apis\/[^\/]+\/[^\/]+/, '').replace(/^\/namespaces\/\{namespace}/, '');

    // Process each method in the path (e.g., get, post)
    const newPathItem: Record<string, unknown> = {};

    // Filter out namespace parameter at path level
    if (Array.isArray(pathItem.parameters)) {
      pathItem.parameters = filterNamespaceParameters(pathItem.parameters);
    }

    for (const method of Object.keys(pathItem)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const operation = pathItem[method as keyof OpenAPIV3.PathItemObject];

      if (
        typeof operation === 'object' &&
        operation !== null &&
        'operationId' in operation &&
        operation.operationId?.includes('ForAllNamespaces')
      ) {
        continue;
      }

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
  // Written in the order they arrived in, so that naming changes show up in a diff on
  // their own rather than alongside a reshuffle of every schema in the document.
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
 * The group the document describes, taken from a path since that is where it appears
 * literally. `info.title` is the fallback, and is not always a group at all - the quotas
 * document calls itself 'Grafana API Server'.
 */
function specGroup(spec: OpenAPIV3.Document) {
  for (const path of Object.keys(spec.paths ?? {})) {
    const match = path.match(/^\/apis\/([^\/]+)\//);
    if (match) {
      return match[1];
    }
  }

  const title = spec.info?.title ?? '';
  return /^\S+\/v\S*$/.test(title) ? title.split('/')[0] : undefined;
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

/**
 * Process all files in a source directory and write results to output directory
 */
function processDirectory(sourceDir: string, outputDir: string) {
  // Skip if source directory doesn't exist
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  // Create the output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDir).filter((file: string) => file.endsWith('.json'));

  for (const file of files) {
    const inputPath = path.join(sourceDir, file);
    const outputPath = path.join(outputDir, file);

    console.log(`Processing file "${file}"...`);

    const fileContent = fs.readFileSync(inputPath, 'utf-8');

    let inputSpec;
    try {
      inputSpec = JSON.parse(fileContent);
    } catch (err) {
      console.error(`Invalid JSON file "${file}". Skipping this file.`);
      continue;
    }

    const outputSpec = processOpenAPISpec(inputSpec);
    fs.writeFileSync(outputPath, JSON.stringify(outputSpec, null, 2), 'utf-8');
    console.log(`Processing completed for file "${file}".`);
  }
}

// Grafana root path - navigate up from this script's directory
const basePath = path.resolve(import.meta.dirname, '../../../..');

const oss = {
  source: path.join(basePath, 'pkg/tests/apis/openapi_snapshots'),
  output: path.join(import.meta.dirname, '../apis'),
};

// This script is also used to process specs from the Enterprise repo but we're not publishing these as part of this package for now
const enterprise = {
  source: path.join(basePath, 'pkg/extensions/apiserver/tests/openapi_snapshots'),
  output: path.join(basePath, 'data/openapi'),
};

for (const config of [oss, enterprise]) {
  processDirectory(config.source, config.output);
}
