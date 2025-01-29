import fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';
import path from 'path';

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

  // Process 'paths' property
  const newPaths: Record<string, unknown> = {};
  for (const [path, pathItem] of Object.entries<OpenAPIV3.PathItemObject>(newSpec.paths)) {
    // Remove 'watch' paths as they're deprecated / remove empty path items
    if (path.includes('/watch/') || !pathItem) {
      continue;
    }
    // Remove the specified part from the path key
    const newPathKey = path.replace(/^\/apis\/[^\/]+\/[^\/]+\/namespaces\/\{namespace}/, '');

    // Process each method in the path (e.g., get, post)
    const newPathItem: Record<string, unknown> = {};
    for (const method of Object.keys(pathItem)) {
      // Filter out the 'namespace' param
      if (method === 'parameters' && Array.isArray(pathItem.parameters)) {
        pathItem.parameters = pathItem.parameters?.filter((param) => 'name' in param && param.name !== 'namespace');
      }

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

      updateRefs(operation);

      newPathItem[method] = operation;
    }

    newPaths[newPathKey] = newPathItem;
  }
  newSpec.paths = newPaths;

  // Process 'components.schemas', i.e., type definitions
  const newSchemas: Record<string, unknown> = {};
  for (const schemaKey of Object.keys(newSpec.components.schemas)) {
    const newKey = simplifySchemaName(schemaKey);

    const schemaObject = newSpec.components.schemas[schemaKey];
    updateRefs(schemaObject);

    newSchemas[newKey] = schemaObject;
  }
  newSpec.components.schemas = newSchemas;

  return newSpec;
}

/**
 * Recursively update all $ref fields to remove k8s metadata from names
 */
function updateRefs(obj: unknown) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      updateRefs(item);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    if ('$ref' in obj && typeof obj.$ref === 'string') {
      const refParts = obj.$ref.split('/');
      const lastRefPart = refParts[refParts.length - 1];
      const newRefName = simplifySchemaName(lastRefPart);
      obj.$ref = `#/components/schemas/${newRefName}`;
    }
    for (const key in obj) {
      if (key !== '$ref') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        updateRefs(obj[key as keyof typeof obj]);
      }
    }
  }
}

/**
 * Simplify a schema name by removing the version prefix if present.
 * For example, 'io.k8s.apimachinery.pkg.apis.meta.v1.Time' becomes 'Time'.
 */
function simplifySchemaName(schemaName: string) {
  const parts = schemaName.split('.');

  // Regex to match version segments like 'v1', 'v1beta1', 'v0alpha1', etc.
  const versionRegex = /^v\d+[a-zA-Z0-9]*$/;
  const versionIndex = parts.findIndex((part) => versionRegex.test(part));

  if (versionIndex !== -1 && versionIndex + 1 < parts.length) {
    return parts.slice(versionIndex + 1).join('.');
  } else {
    return schemaName;
  }
}

const sourceDir = path.resolve(__dirname, '../pkg/tests/apis/openapi_snapshots');
const outputDir = path.resolve(__dirname, '../data/openapi');

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
