const fs = require('fs');
const path = require('path');

interface OpenAPISpec {
  paths: Record<string, object>;
  components: {
    schemas: Record<string, object>;
  };
  [key: string]: unknown;
}

function processOpenAPISpec(spec: OpenAPISpec): OpenAPISpec {
  // Create a deep copy of the spec to avoid mutating the original
  const newSpec = JSON.parse(JSON.stringify(spec));

  // Process 'paths' property
  const newPaths: Record<string, unknown> = {};
  for (const [path, pathItem] of Object.entries<Record<string, unknown>>(newSpec.paths)) {
    // Remove 'watch' paths as they're deprecated
    if (path.includes('/watch/')) {
      continue;
    }
    // Remove the specified part from the path key
    const newPathKey = path.replace(/^\/apis\/[^\/]+\/[^\/]+\/namespaces\/\{namespace}/, '');

    // Process each method in the path (e.g., get, post)
    const newPathItem: Record<string, unknown> = {};
    for (const method of Object.keys(pathItem)) {
      // Filter out the 'namespace' param
      if (method === 'parameters' && Array.isArray(pathItem.parameters)) {
        pathItem.parameters = pathItem.parameters?.filter((param) => param.name !== 'namespace');
      }

      const operation = pathItem[method];
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
// Process all OpenAPI specs in the specs directory
const specsDir = path.resolve(__dirname, '../data/specs');

// Get all subdirectories in the specs folder
const specFolders = fs.readdirSync(specsDir).filter((file: string) => {
  return fs.statSync(path.join(specsDir, file)).isDirectory();
});

// Process each spec folder
for (const folder of specFolders) {
  const inputPath = path.join(specsDir, folder, 'openapi.json');
  const outputPath = path.join(specsDir, folder, 'spec.json');

  // Skip if input file doesn't exist
  if (!fs.existsSync(inputPath)) {
    continue;
  }

  console.log(`Processing spec for ${folder}...`);
  const inputSpec = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const outputSpec = processOpenAPISpec(inputSpec);
  fs.writeFileSync(outputPath, JSON.stringify(outputSpec, null, 2), 'utf-8');
  console.log(`Processing completed for ${folder}`);
}
