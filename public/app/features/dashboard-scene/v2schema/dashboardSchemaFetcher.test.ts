/** @jest-environment-options {"customExportConditions": ["@grafana-app/source", "node", "node-addons"]} */

import { CompletionContext, type CompletionSource } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

import type { BackendSrv } from '@grafana/runtime';

import dashboardFixture from '../../../../../apps/dashboard/pkg/migration/conversion/testdata/input/v2beta1.complete.json';
import openApiV2 from '../../../../../packages/grafana-openapi/src/apis/dashboard.grafana.app-v2.json';
import openApiV2beta1 from '../../../../../packages/grafana-openapi/src/apis/dashboard.grafana.app-v2beta1.json';

// Only tooltip rendering needs Shiki's ESM/WASM runtime; validation runs unmocked.
jest.mock(require.resolve('codemirror-json-schema').replace('index.js', 'utils/markdown.js'), () => ({
  renderMarkdown: (text: string) => text,
}));

const PREFIX = 'com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1';

// Minimal OpenAPI schema that reproduces the generator's interface{} → { type: "object" } mismatch.
function buildMockOpenApiSchema() {
  return {
    components: {
      schemas: {
        [`${PREFIX}.Dashboard`]: {
          type: 'object',
          required: ['kind', 'spec'],
          properties: {
            kind: { type: 'string' },
            spec: { $ref: `#/components/schemas/${PREFIX}.DashboardSpec` },
          },
        },
        [`${PREFIX}.DashboardSpec`]: {
          type: 'object',
          properties: {
            elements: {
              type: 'object',
              additionalProperties: {
                allOf: [{ $ref: `#/components/schemas/${PREFIX}.DashboardPanelKind` }],
              },
            },
            variables: {
              type: 'array',
              items: { $ref: `#/components/schemas/${PREFIX}.DashboardQueryVariableKindOrTextVariableKind` },
            },
          },
        },
        [`${PREFIX}.DashboardPanelKind`]: {
          type: 'object',
          required: ['kind', 'spec'],
          properties: {
            kind: { type: 'string' },
            spec: { $ref: `#/components/schemas/${PREFIX}.DashboardPanelSpec` },
          },
        },
        [`${PREFIX}.DashboardPanelSpec`]: {
          type: 'object',
          properties: {
            vizConfig: { $ref: `#/components/schemas/${PREFIX}.DashboardVizConfigKind` },
          },
        },
        [`${PREFIX}.DashboardVizConfigKind`]: {
          type: 'object',
          required: ['kind', 'spec'],
          properties: {
            kind: { type: 'string' },
            spec: { $ref: `#/components/schemas/${PREFIX}.DashboardVizConfigSpec` },
          },
        },
        [`${PREFIX}.DashboardVizConfigSpec`]: {
          type: 'object',
          properties: {
            fieldConfig: { $ref: `#/components/schemas/${PREFIX}.DashboardFieldConfigSource` },
            options: {
              type: 'object',
              additionalProperties: { type: 'object' },
            },
          },
        },
        [`${PREFIX}.DashboardFieldConfigSource`]: {
          type: 'object',
          properties: {
            defaults: { $ref: `#/components/schemas/${PREFIX}.DashboardFieldConfig` },
            overrides: {
              type: 'array',
              items: { $ref: `#/components/schemas/${PREFIX}.DashboardFieldConfigOverride` },
            },
          },
        },
        [`${PREFIX}.DashboardFieldConfig`]: {
          type: 'object',
          properties: {
            custom: { type: 'object', additionalProperties: { type: 'object' } },
            color: { type: 'object', properties: { mode: { type: 'string' } } },
          },
        },
        [`${PREFIX}.DashboardFieldConfigOverride`]: {
          type: 'object',
          properties: {
            matcher: {
              allOf: [{ $ref: `#/components/schemas/${PREFIX}.DashboardMatcherConfig` }],
            },
            properties: {
              type: 'array',
              items: {
                allOf: [{ $ref: `#/components/schemas/${PREFIX}.DashboardDynamicConfigValue` }],
              },
            },
          },
        },
        [`${PREFIX}.DashboardMatcherConfig`]: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
            options: { type: 'object' },
          },
        },
        [`${PREFIX}.DashboardDynamicConfigValue`]: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
            value: { type: 'object' },
          },
        },
        [`${PREFIX}.DashboardDataTransformerConfig`]: {
          type: 'object',
          required: ['id', 'options'],
          properties: {
            id: { type: 'string' },
            options: { type: 'object' },
            filter: {
              allOf: [{ $ref: `#/components/schemas/${PREFIX}.DashboardMatcherConfig` }],
            },
          },
        },
        [`${PREFIX}.DashboardDataQueryKind`]: {
          type: 'object',
          required: ['kind', 'spec'],
          properties: {
            kind: { type: 'string' },
            spec: { type: 'object', additionalProperties: { type: 'object' } },
          },
        },
        [`${PREFIX}.DashboardAnnotationQuerySpec`]: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            legacyOptions: { type: 'object', additionalProperties: { type: 'object' } },
          },
        },
        [`${PREFIX}.DashboardElementReference`]: {
          type: 'object',
          required: ['kind', 'name'],
          properties: {
            kind: { type: 'string' },
            name: { type: 'string' },
          },
        },
        [`${PREFIX}.DashboardQueryVariableKindOrTextVariableKind`]: {
          type: 'object',
          properties: {
            queryVariable: { $ref: `#/components/schemas/${PREFIX}.DashboardQueryVariableKind` },
            textVariable: { $ref: `#/components/schemas/${PREFIX}.DashboardTextVariableKind` },
          },
        },
        [`${PREFIX}.DashboardQueryVariableKind`]: {
          type: 'object',
          required: ['kind', 'spec'],
          properties: {
            kind: { type: 'string' },
            spec: {
              type: 'object',
              required: ['query'],
              properties: { query: { $ref: `#/components/schemas/${PREFIX}.DashboardDataQueryKind` } },
            },
          },
        },
        [`${PREFIX}.DashboardTextVariableKind`]: {
          type: 'object',
          required: ['kind', 'spec'],
          properties: {
            kind: { type: 'string' },
            spec: {
              type: 'object',
              required: ['query'],
              properties: { query: { $ref: `#/components/schemas/${PREFIX}.DashboardStringOrArrayOfString` } },
            },
          },
        },
        [`${PREFIX}.DashboardStringOrArrayOfString`]: {
          type: 'object',
          properties: { string: { type: 'string' }, arrayOfString: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
  };
}

const DEF_PREFIX = PREFIX.replace(/\./g, '_');

const mockGet = jest.fn();
const mockResolve = jest.fn();
let mockSchemaVersion = 'v2beta1';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: (): Partial<BackendSrv> => ({ get: mockGet }),
}));

jest.mock('app/features/dashboard/api/DashboardAPIVersionResolver', () => ({
  dashboardAPIVersionResolver: {
    resolve: mockResolve,
  },
}));

jest.mock('app/features/dashboard/api/v2', () => ({
  getK8sV2DashboardApiConfig: () => ({
    group: 'dashboard.grafana.app',
    version: mockSchemaVersion,
    resource: 'dashboards',
  }),
}));

import { createDashboardSchemaExtensions, createDashboardSchemaValidator } from './dashboardSchemaExtensions';
import { fetchDashboardSchema } from './dashboardSchemaFetcher';

type Definitions = Record<string, { type?: string; properties?: Record<string, Record<string, unknown>> }>;

describe('dashboardSchemaFetcher', () => {
  let definitions: Definitions;
  let validate: ReturnType<typeof createDashboardSchemaValidator>;

  beforeAll(async () => {
    mockResolve.mockResolvedValue({ v1: 'v1beta1', v2: 'v2beta1' });
    mockGet.mockResolvedValue(buildMockOpenApiSchema());

    const schema = await fetchDashboardSchema();
    definitions = schema.definitions as unknown as Definitions;
    validate = createDashboardSchemaValidator(schema);
  });

  describe('CodeMirror compatibility with the fetched Dashboard schema', () => {
    it('accepts plugin options and override values without changing the resource', () => {
      const text = JSON.stringify({
        kind: 'Dashboard',
        spec: {
          elements: {
            panel: {
              kind: 'Panel',
              spec: {
                vizConfig: {
                  kind: 'VizConfig',
                  spec: {
                    options: { enabled: true, count: 5, label: 'example', values: [1, null] },
                    fieldConfig: {
                      defaults: { custom: { enabled: true } },
                      overrides: [
                        { matcher: { id: 'byName', options: 'cpu' }, properties: [{ id: 'unit', value: 'bytes' }] },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      });
      expect(validate(text)).toEqual({ diagnostics: [], hasErrors: false, hasParseError: false, json: text });
    });

    it.each([
      { kind: 'TextVariable', spec: { query: 'example' } },
      { kind: 'TextVariable', spec: { query: ['one', 'two'] } },
      { kind: 'QueryVariable', spec: { query: { kind: 'DataQuery', spec: { expr: 'up', instant: true } } } },
    ])('accepts the corrected $kind discriminated union and scalar union', (variable) => {
      expect(validate(JSON.stringify({ kind: 'Dashboard', spec: { variables: [variable] } })).hasErrors).toBe(false);
    });

    it.each([
      { kind: 'TextVariable', spec: { query: 123 } },
      { kind: 'QueryVariable', spec: { query: 'not a query resource' } },
      { kind: 'UnknownVariable', spec: { query: '' } },
      { kind: 'TextVariable', spec: {} },
    ])('rejects an invalid $kind variant using Draft 7 rules', (variable) => {
      const result = validate(JSON.stringify({ kind: 'Dashboard', spec: { variables: [variable] } }));
      expect(result).toMatchObject({ hasErrors: true, hasParseError: false });
      expect(result.diagnostics[0]).toMatchObject({ severity: 'error', source: 'Dashboard schema' });
    });

    it('rejects a wrong constant kind through a rewritten component reference', () => {
      const text = JSON.stringify({ kind: 'Dashboard', spec: { elements: { panel: { kind: 'Other', spec: {} } } } });
      const result = validate(text);
      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics[0].message).toContain('Panel');
      expect(text.slice(result.diagnostics[0].from, result.diagnostics[0].to)).toBe('"Other"');
    });
  });

  describe('fixAnyValueProperties — interface{} fields that accept any JSON type', () => {
    it('DashboardDynamicConfigValue.value accepts any type (string, number, boolean, array, object)', () => {
      const def = definitions[`${DEF_PREFIX}_DashboardDynamicConfigValue`];
      expect(def).toBeDefined();
      expect(def.properties!.value).toEqual({});
    });

    it('DashboardMatcherConfig.options accepts any type', () => {
      const def = definitions[`${DEF_PREFIX}_DashboardMatcherConfig`];
      expect(def).toBeDefined();
      expect(def.properties!.options).toEqual({});
    });

    it('DashboardDataTransformerConfig.options accepts any type', () => {
      const def = definitions[`${DEF_PREFIX}_DashboardDataTransformerConfig`];
      expect(def).toBeDefined();
      expect(def.properties!.options).toEqual({});
    });
  });

  describe('fixOpaqueMaps — map[string]interface{} as object with any values', () => {
    it('DashboardVizConfigSpec.options is an opaque object', () => {
      const def = definitions[`${DEF_PREFIX}_DashboardVizConfigSpec`];
      expect(def.properties!.options).toEqual({ type: 'object', additionalProperties: true });
    });

    it('DashboardFieldConfig.custom is an opaque object', () => {
      const def = definitions[`${DEF_PREFIX}_DashboardFieldConfig`];
      expect(def.properties!.custom).toEqual({ type: 'object', additionalProperties: true });
    });

    it('DashboardDataQueryKind.spec is an opaque object', () => {
      const def = definitions[`${DEF_PREFIX}_DashboardDataQueryKind`];
      expect(def.properties!.spec).toEqual({ type: 'object', additionalProperties: true });
    });

    it('DashboardAnnotationQuerySpec.legacyOptions is an opaque object', () => {
      const def = definitions[`${DEF_PREFIX}_DashboardAnnotationQuerySpec`];
      expect(def.properties!.legacyOptions).toEqual({ type: 'object', additionalProperties: true });
    });
  });

  describe('fixKindConstraints', () => {
    it('adds const for DashboardElementReference.kind', () => {
      const def = definitions[`${DEF_PREFIX}_DashboardElementReference`];
      expect(def.properties!.kind.const).toBe('ElementReference');
    });
  });

  describe('API version resolution', () => {
    it('awaits version resolution before fetching schema', () => {
      // resolve() should have been called before get()
      expect(mockResolve).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledTimes(1);
      const resolveOrder = mockResolve.mock.invocationCallOrder[0];
      const getOrder = mockGet.mock.invocationCallOrder[0];
      expect(resolveOrder).toBeLessThan(getOrder);
    });

    it('fetches from the correct OpenAPI endpoint', () => {
      expect(mockGet).toHaveBeenCalledWith('/openapi/v3/apis/dashboard.grafana.app/v2beta1');
    });
  });
});

describe('CodeMirror compatibility with checked-in Dashboard OpenAPI schemas', () => {
  it.each([
    ['v2beta1', openApiV2beta1],
    ['v2', openApiV2],
  ] as const)('validates a complete Dashboard resource against %s', async (version, openApi) => {
    mockSchemaVersion = version;
    const prefix = `com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.${version}`;
    // Client generation shortens component names; the backend returns qualified names.
    const schemas = Object.fromEntries(
      Object.entries(openApi.components.schemas).map(([name, schema]) => [
        `${prefix}.${name}`,
        JSON.parse(JSON.stringify(schema).replaceAll('"#/components/schemas/', `"#/components/schemas/${prefix}.`)),
      ])
    );
    mockGet.mockResolvedValue({ components: { schemas } });
    await jest.isolateModulesAsync(async () => {
      const { fetchDashboardSchema } = await import('./dashboardSchemaFetcher');
      const schema = await fetchDashboardSchema();
      const validate = createDashboardSchemaValidator(schema);
      // This is migration INPUT: normalize its historical row, nil-slice, and
      // transformation shapes to what the current scene serializer writes.
      const resource = JSON.parse(JSON.stringify(dashboardFixture));
      resource.apiVersion = `dashboard.grafana.app/${version}`;
      resource.spec.layout.spec.rows[0].kind = 'RowsLayoutRow';
      for (const variable of resource.spec.variables) {
        if (variable.spec.options === null) {
          variable.spec.options = [];
        }
      }
      for (const transformation of resource.spec.elements['panel-1'].spec.data.spec.transformations) {
        transformation.group = transformation.kind;
        transformation.kind = 'Transformation';
      }
      const text = JSON.stringify(resource);
      const result = validate(text);
      expect(result.diagnostics).toEqual([]);
      expect(result).toMatchObject({ hasErrors: false, hasParseError: false, json: text });

      const invalid = JSON.parse(text);
      invalid.spec.title = 123;
      const invalidResult = validate(JSON.stringify(invalid));
      expect(invalidResult).toMatchObject({ hasErrors: true, hasParseError: false });
      expect(invalidResult.diagnostics[0].message).toContain('/spec/title');

      const doc = '{"spec":{"layout":{"kind":"","spec":{}}}}';
      const state = EditorState.create({ doc, extensions: createDashboardSchemaExtensions(schema) });
      const pos = doc.indexOf('""') + 1;
      const [complete] = state.languageDataAt<CompletionSource>('autocomplete', pos);
      const completions = await complete(new CompletionContext(state, pos, true));
      expect(completions?.options.map((option) => option.label).sort()).toEqual([
        'AutoGridLayout',
        'GridLayout',
        'RowsLayout',
        'TabsLayout',
      ]);
    });
  });
});
