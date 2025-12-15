import { getBackendSrv } from '@grafana/runtime';

interface OpenAPISchema {
  components?: {
    schemas?: Record<string, JSONSchema>;
  };
}

interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  $ref?: string;
  allOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  additionalProperties?: boolean | JSONSchema;
  required?: string[];
  enum?: string[];
  const?: string;
  default?: unknown;
  description?: string;
  [key: string]: unknown;
}

const DASHBOARD_SPEC_SCHEMA_KEY = 'com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardSpec';
const OPENAPI_ENDPOINT = '/openapi/v3/apis/dashboard.grafana.app/v2beta1';

let cachedSchema: JSONSchema | null = null;
let fetchPromise: Promise<JSONSchema> | null = null;

/**
 * Fetches the dashboard v2beta1 OpenAPI schema and converts it to a JSON Schema
 * format suitable for Monaco editor validation.
 *
 * The schema is cached after the first successful fetch.
 */
export async function fetchDashboardV2Schema(): Promise<JSONSchema> {
  if (cachedSchema) {
    return cachedSchema;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = doFetchSchema();

  try {
    cachedSchema = await fetchPromise;
    return cachedSchema;
  } finally {
    fetchPromise = null;
  }
}

async function doFetchSchema(): Promise<JSONSchema> {
  const openApiSchema = await getBackendSrv().get<OpenAPISchema>(OPENAPI_ENDPOINT);

  if (!openApiSchema.components?.schemas) {
    throw new Error('OpenAPI schema does not contain component schemas');
  }

  const schemas = openApiSchema.components.schemas;
  const specSchema = schemas[DASHBOARD_SPEC_SCHEMA_KEY];

  if (!specSchema) {
    throw new Error(`Dashboard spec schema not found: ${DASHBOARD_SPEC_SCHEMA_KEY}`);
  }

  // Build a JSON Schema with definitions for all referenced schemas
  // Monaco's JSON validation supports $ref with definitions
  const definitions: Record<string, JSONSchema> = {};

  // Add all component schemas as definitions, converting the key format
  for (const [key, schema] of Object.entries(schemas)) {
    const definitionKey = convertRefToDefinitionKey(key);
    definitions[definitionKey] = convertOpenAPIToJSONSchema(schema);
  }

  const jsonSchema: JSONSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...convertOpenAPIToJSONSchema(specSchema),
    definitions,
  };

  // Convert all $ref paths from OpenAPI format to JSON Schema definitions format
  replaceRefs(jsonSchema);

  return jsonSchema;
}

/**
 * Converts an OpenAPI schema to JSON Schema format.
 * Mainly handles the `allOf` wrapper pattern used in OpenAPI for $ref.
 */
function convertOpenAPIToJSONSchema(schema: JSONSchema): JSONSchema {
  const result: JSONSchema = { ...schema };

  // OpenAPI often wraps $ref in allOf with default values, flatten it
  if (result.allOf && result.allOf.length === 1 && result.allOf[0].$ref) {
    const ref = result.allOf[0].$ref;
    delete result.allOf;
    result.$ref = ref;
  }

  return result;
}

/**
 * Converts OpenAPI schema key to a valid JSON Schema definition key.
 * e.g., "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardSpec"
 * becomes "DashboardSpec" or a sanitized version
 */
function convertRefToDefinitionKey(key: string): string {
  // Use the full key but replace dots with underscores for valid JSON pointer
  return key.replace(/\./g, '_');
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * Recursively replaces OpenAPI $ref paths with JSON Schema definition paths.
 * e.g., "#/components/schemas/com.github..." becomes "#/definitions/com_github..."
 */
function replaceRefs(obj: unknown): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      replaceRefs(item);
    }
    return;
  }

  if (!isRecord(obj)) {
    return;
  }

  if (typeof obj.$ref === 'string' && obj.$ref.startsWith('#/components/schemas/')) {
    const schemaKey = obj.$ref.replace('#/components/schemas/', '');
    const definitionKey = convertRefToDefinitionKey(schemaKey);
    obj.$ref = `#/definitions/${definitionKey}`;
  }

  for (const value of Object.values(obj)) {
    replaceRefs(value);
  }
}
