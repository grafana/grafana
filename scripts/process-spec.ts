const fs = require('fs');
const path = require('path');

interface OpenAPISpec {
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
  };
  [key: string]: any;
}

function processOpenAPISpec(spec: OpenAPISpec): OpenAPISpec {
  // Create a deep copy of the spec to avoid mutating the original
  const newSpec = JSON.parse(JSON.stringify(spec));

  // Process 'paths' property
  const newPaths: Record<string, any> = {};
  for (const [path, pathItem] of Object.entries<Record<string, any>>(newSpec.paths)) {
    // Remove the specified part from the path key
    const newPathKey = path.replace(/^\/apis\/[^\/]+\/[^\/]+\/namespaces\/\{namespace}/, '');

    // Process each method in the path (e.g., get, post)
    const newPathItem: Record<string, any> = {};
    for (const method of Object.keys(pathItem)) {
      // Filter out the 'namespace' param
      if (method === 'parameters') {
        pathItem.parameters = pathItem.parameters?.filter((param: any) => param.name !== 'namespace');
      }

      const operation = pathItem[method];
      removeDescription(operation);
      updateRefs(operation);

      newPathItem[method] = operation;
    }

    newPaths[newPathKey] = newPathItem;
  }
  newSpec.paths = newPaths;

  // Process 'components.schemas'
  const newSchemas: Record<string, any> = {};
  for (const schemaKey of Object.keys(newSpec.components.schemas)) {
    const newKey = simplifySchemaName(schemaKey);

    const schemaObject = newSpec.components.schemas[schemaKey];
    removeDescription(schemaObject);
    updateRefs(schemaObject);

    newSchemas[newKey] = schemaObject;
  }
  newSpec.components.schemas = newSchemas;

  return newSpec;
}

/**
 * Recursively remove 'description' fields from all objects, effectively removing all comments from the generated API
 * TODO handle case when the actual field name is 'description'
 */
function removeDescription(obj: any) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      removeDescription(item);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    delete obj.description;
    for (const key in obj) {
      removeDescription(obj[key]);
    }
  }
}

/**
 * Recursively update all $ref fields to remove k8s metadata from names
 */
function updateRefs(obj: any) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      updateRefs(item);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    if (obj.$ref && typeof obj.$ref === 'string') {
      const refParts = obj.$ref.split('/');
      const lastRefPart = refParts[refParts.length - 1];
      const newRefName = simplifySchemaName(lastRefPart);
      obj.$ref = `#/components/schemas/${newRefName}`;
    }
    for (const key in obj) {
      if (key !== '$ref') {
        updateRefs(obj[key]);
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

const filePath = path.resolve(__dirname, '../data/specs/query-library/openapi.json');
const outputFilePath = path.resolve(__dirname, '../data/specs/query-library/spec.json');

const inputSpec = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const outputSpec = processOpenAPISpec(inputSpec);
fs.writeFileSync(outputFilePath, JSON.stringify(outputSpec, null, 2), 'utf-8');
