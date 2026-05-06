import type { BackendSrv } from '@grafana/runtime';

const PREFIX = 'com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1';

// Minimal OpenAPI schema that reproduces the generator's interface{} → { type: "object" } mismatch.
function buildMockOpenApiSchema() {
  return {
    components: {
      schemas: {
        [`${PREFIX}.DashboardSpec`]: {
          type: 'object',
          properties: {
            elements: {
              type: 'object',
              additionalProperties: {
                allOf: [{ $ref: `#/components/schemas/${PREFIX}.DashboardPanelKind` }],
              },
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
      },
    },
  };
}

const DEF_PREFIX = PREFIX.replace(/\./g, '_');

const mockGet = jest.fn();
const mockResolve = jest.fn();

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
    version: 'v2beta1',
    resource: 'dashboards',
  }),
}));

import { fetchDashboardSchema } from './dashboardSchemaFetcher';

type Definitions = Record<string, { type?: string; properties?: Record<string, Record<string, unknown>> }>;

describe('dashboardSchemaFetcher', () => {
  let definitions: Definitions;

  beforeAll(async () => {
    mockResolve.mockResolvedValue({ v1: 'v1beta1', v2: 'v2beta1' });
    mockGet.mockResolvedValue(buildMockOpenApiSchema());

    const schema = await fetchDashboardSchema();
    definitions = schema.definitions as unknown as Definitions;
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
