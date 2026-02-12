import { getBackendSrv } from '@grafana/runtime';
import { K8S_V2_DASHBOARD_API_CONFIG } from 'app/features/dashboard/api/v2';

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

/**
 * Builds the OpenAPI endpoint URL for a given API group and version.
 */
function getOpenAPIEndpoint(group: string, version: string): string {
  return `/openapi/v3/apis/${group}/${version}`;
}

/**
 * Builds the schema key for DashboardSpec based on the API version.
 * The key format follows the OpenAPI schema naming convention used by Grafana's API server.
 */
function getDashboardSpecSchemaKey(version: string): string {
  return `com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.${version}.DashboardSpec`;
}

let cachedSchema: JSONSchema | null = null;
let fetchPromise: Promise<JSONSchema> | null = null;

export async function fetchDashboardSchema(): Promise<JSONSchema> {
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
  const { group, version } = K8S_V2_DASHBOARD_API_CONFIG;
  const endpoint = getOpenAPIEndpoint(group, version);
  const schemaKey = getDashboardSpecSchemaKey(version);

  const openApiSchema = await getBackendSrv().get<OpenAPISchema>(endpoint);

  if (!openApiSchema.components?.schemas) {
    throw new Error('OpenAPI schema does not contain component schemas');
  }

  const schemas = openApiSchema.components.schemas;
  const specSchema = schemas[schemaKey];

  if (!specSchema) {
    throw new Error(`Dashboard spec schema not found: ${schemaKey}`);
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

  // Inject const constraints for kind fields that the OpenAPI generator doesn't emit
  injectKindConstraints(definitions);

  // Fix scalar union types whose OpenAPI schema is a struct but the wire format is a plain value
  fixScalarUnions(definitions);

  // Fix map[string]interface{} properties where the generator restricts values to objects
  fixOpaqueMaps(definitions);

  // Convert discriminated union types from struct-based properties to if/then schemas
  fixDiscriminatedUnions(definitions);

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

// Scalar union types: custom marshalers serialize as plain values,
// but the generator emits struct-based schemas.
const SCALAR_UNION_REPLACEMENTS: Record<string, JSONSchema> = {
  DashboardStringOrArrayOfString: {
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  },
  DashboardStringOrFloat64: {
    oneOf: [{ type: 'string' }, { type: 'number' }],
  },
};

function fixScalarUnions(definitions: Record<string, JSONSchema>): void {
  for (const [key, schema] of Object.entries(definitions)) {
    for (const [suffix, replacement] of Object.entries(SCALAR_UNION_REPLACEMENTS)) {
      if (key.endsWith(`_${suffix}`)) {
        delete schema.type;
        delete schema.properties;
        delete schema.required;
        Object.assign(schema, replacement);
        break;
      }
    }
  }
}

// map[string]interface{} properties: the generator maps interface{} to { type: object },
// incorrectly rejecting primitives as map values.
const OPAQUE_MAP_PROPERTIES: Record<string, string[]> = {
  DashboardFieldConfig: ['custom'],
  DashboardVizConfigSpec: ['options'],
};

function fixOpaqueMaps(definitions: Record<string, JSONSchema>): void {
  for (const [key, schema] of Object.entries(definitions)) {
    for (const [suffix, props] of Object.entries(OPAQUE_MAP_PROPERTIES)) {
      if (key.endsWith(`_${suffix}`)) {
        for (const p of props) {
          if (schema.properties?.[p]) {
            schema.properties[p] = { type: 'object', additionalProperties: true };
          }
        }
      }
    }
  }
}

// Kind values that are dynamic (e.g. plugin ID), not fixed strings.
const DYNAMIC_KIND_DEFINITIONS = new Set(['TransformationKind']);

/**
 * Injects `const` on `kind` properties. The Go generator emits `type: string`,
 * but `Dashboard<Name>Kind` types always have a fixed kind value derived from the type name.
 */
function injectKindConstraints(definitions: Record<string, JSONSchema>): void {
  for (const [key, schema] of Object.entries(definitions)) {
    const kindProp = schema.properties?.kind;
    if (!kindProp || kindProp.type !== 'string') {
      continue;
    }

    const match = key.match(/_Dashboard(\w+Kind)$/);
    if (match) {
      if (!DYNAMIC_KIND_DEFINITIONS.has(match[1])) {
        kindProp.const = match[1].replace(/Kind$/, '');
      }
      continue;
    }

    if (key.endsWith('_DashboardElementReference')) {
      kindProp.const = 'ElementReference';
    }
  }
}

// Unions that use a field other than `kind` as discriminator.
// kind-discriminated unions are auto-detected via "KindOr" in the definition key.
const TYPE_DISCRIMINATED_UNIONS: Record<
  string,
  { discriminator: string; variants: Array<{ value: string; refSuffix: string }> }
> = {
  DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap: {
    discriminator: 'type',
    variants: [
      { value: 'value', refSuffix: 'DashboardValueMap' },
      { value: 'range', refSuffix: 'DashboardRangeMap' },
      { value: 'regex', refSuffix: 'DashboardRegexMap' },
      { value: 'special', refSuffix: 'DashboardSpecialValueMap' },
    ],
  },
};

/**
 * Converts discriminated union definitions from struct-based properties to
 * `allOf` schemas with `if/then` conditions. Handles two patterns:
 * - kind-discriminated: auto-detected via "KindOr" in the definition key
 * - type-discriminated: configured in TYPE_DISCRIMINATED_UNIONS
 */
function fixDiscriminatedUnions(definitions: Record<string, JSONSchema>): void {
  for (const [key, schema] of Object.entries(definitions)) {
    // Auto-detect kind-discriminated unions
    if (key.includes('KindOr') && schema.properties) {
      const variants = collectKindVariants(schema.properties);
      if (variants.length > 0) {
        applyDiscriminatedUnion(schema, 'kind', variants, ['kind', 'spec']);
        continue;
      }
    }

    // Manually configured type-discriminated unions
    for (const [suffix, config] of Object.entries(TYPE_DISCRIMINATED_UNIONS)) {
      if (!key.endsWith(`_${suffix}`)) {
        continue;
      }
      const prefix = key.replace(suffix, '');
      const variants = config.variants
        .filter((v) => definitions[`${prefix}${v.refSuffix}`])
        .map((v) => ({ value: v.value, ref: `#/definitions/${prefix}${v.refSuffix}` }));
      if (variants.length > 0) {
        applyDiscriminatedUnion(schema, config.discriminator, variants);
      }
      break;
    }
  }
}

/** Extracts variant refs and kind values from a kind-discriminated union's properties. */
function collectKindVariants(properties: Record<string, JSONSchema>): Array<{ value: string; ref: string }> {
  const variants: Array<{ value: string; ref: string }> = [];
  for (const propSchema of Object.values(properties)) {
    if (!propSchema.$ref) {
      return []; // All properties must be $ref for this to be a union
    }
    const match = propSchema.$ref.replace('#/definitions/', '').match(/_Dashboard(\w+)Kind$/);
    if (match) {
      variants.push({ value: match[1], ref: propSchema.$ref });
    }
  }
  return variants;
}

/** Replaces a schema in-place with an allOf + if/then discriminated union. */
function applyDiscriminatedUnion(
  schema: JSONSchema,
  discriminator: string,
  variants: Array<{ value: string; ref: string }>,
  requiredFields?: string[]
): void {
  delete schema.type;
  delete schema.properties;
  delete schema.required;

  schema.type = 'object';
  schema.required = requiredFields ?? [discriminator];
  schema.properties = {
    [discriminator]: { type: 'string', enum: variants.map((v) => v.value) },
  };
  schema.allOf = variants.map((v) => ({
    if: { properties: { [discriminator]: { const: v.value } } },
    then: { $ref: v.ref },
  }));
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
