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
  for (const path in newSpec.paths) {
    // Remove the specified part from the path key
    const newPathKey = path.replace(/^\/apis\/[^\/]+\/[^\/]+\/namespaces\/\{namespace\}/, '');

    // Process each method in the path (e.g., get, post)
    const pathItem = newSpec.paths[path];
    const newPathItem: Record<string, any> = {};

    for (const method in pathItem) {
      const operation = pathItem[method];

      // Remove 'description' fields recursively
      removeDescription(operation);

      // Update $ref fields in 'responses' and 'requestBody'
      if (operation.responses) {
        updateRefs(operation.responses);
      }
      if (operation.requestBody && operation.requestBody.content) {
        updateRefs(operation.requestBody.content);
      }

      // Update $ref fields in 'parameters'
      if (operation.parameters) {
        for (const parameter of operation.parameters) {
          updateRefs(parameter);
        }
      }

      newPathItem[method] = operation;
    }

    newPaths[newPathKey] = newPathItem;
  }
  newSpec.paths = newPaths;

  // Process 'components.schemas'
  const newSchemas: Record<string, any> = {};
  for (const schemaKey in newSpec.components.schemas) {
    // Simplify the schema key
    const newKey = simplifySchemaName(schemaKey);

    // Remove 'description' fields recursively in the schema object
    const schemaObject = newSpec.components.schemas[schemaKey];
    removeDescription(schemaObject);

    // Update $ref fields in the schema object
    updateRefs(schemaObject);

    newSchemas[newKey] = schemaObject;
  }
  newSpec.components.schemas = newSchemas;

  return newSpec;
}

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

function updateRefs(obj: any) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      updateRefs(item);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    if (obj.$ref && typeof obj.$ref === 'string') {
      // Extract the schema name
      const refParts = obj.$ref.split('/');
      const lastRefPart = refParts[refParts.length - 1];
      // Simplify the schema name
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

function simplifySchemaName(schemaName: string): string {
  // Split the schema name by '.'
  const parts = schemaName.split('.');

  // Regex to match version segments like 'v1', 'v1beta1', 'v0alpha1', etc.
  const versionRegex = /^v\d+[a-zA-Z0-9]*$/;
  const versionIndex = parts.findIndex((part) => versionRegex.test(part));

  if (versionIndex !== -1 && versionIndex + 1 < parts.length) {
    // Return everything after the version segment
    return parts.slice(versionIndex + 1).join('.');
  } else {
    // If version segment not found, return the original name
    return schemaName;
  }
}
const filePath = path.resolve(__dirname, '../data/specs/query-library/openapi.json');
const outputFilePath = path.resolve(__dirname, '../data/specs/query-library/spec.json');

const inputSpec = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const outputSpec = processOpenAPISpec(inputSpec);
fs.writeFileSync(outputFilePath, JSON.stringify(outputSpec, null, 2), 'utf-8');
