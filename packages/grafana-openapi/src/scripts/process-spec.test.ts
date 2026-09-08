import { type OpenAPIV3 } from 'openapi-types';

import { processOpenAPISpec } from './process-spec';

const SEARCH_RESULTS = 'com.github.grafana.grafana.pkg.apis.search.v0alpha1.SearchResults';
const RESOURCE_REF = 'com.github.grafana.grafana.pkg.apis.search.v0alpha1.ResourceRef';

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

/**
 * A dashboard document that serves the shared search endpoint and, like the real one
 * used to, registers a SearchResults of its own under a short key.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const specWithClashingNames = () =>
  ({
    openapi: '3.0.0',
    info: { title: 'dashboard.grafana.app/v0alpha1', version: 'v0alpha1' },
    paths: {
      '/apis/dashboard.grafana.app/v0alpha1/search': {
        get: {
          operationId: 'searchDashboards',
          responses: { 200: { content: { 'application/json': { schema: ref('SearchResults') } } } },
        },
      },
      '/apis/dashboard.grafana.app/v0alpha1/namespaces/{namespace}/dashboards/{name}/search': {
        parameters: [
          { name: 'namespace', in: 'path' },
          { name: 'name', in: 'path' },
        ],
        get: {
          operationId: 'searchDashboardResources',
          responses: { 200: { content: { 'application/json': { schema: ref(SEARCH_RESULTS) } } } },
        },
      },
      '/apis/dashboard.grafana.app/v0alpha1/watch/dashboards': {
        get: { operationId: 'watchDashboards', responses: {} },
      },
    },
    components: {
      schemas: {
        SearchResults: { type: 'object', properties: { hits: { type: 'array' } } },
        [SEARCH_RESULTS]: { type: 'object', properties: { items: { $ref: `#/components/schemas/${RESOURCE_REF}` } } },
        [RESOURCE_REF]: { type: 'object', properties: { name: { type: 'string' } } },
      },
    },
  }) as unknown as OpenAPIV3.Document;

describe('processOpenAPISpec', () => {
  it('publishes both schemas when two of them simplify to the same name', () => {
    const processed = processOpenAPISpec(specWithClashingNames());

    // The shared search schema keeps the plain name; the dashboard's own takes its group.
    expect(Object.keys(processed.components.schemas).sort()).toEqual([
      'DashboardSearchResults',
      'ResourceRef',
      'SearchResults',
    ]);
  });

  it('points every $ref at the schema it was pointing at before', () => {
    const processed = processOpenAPISpec(specWithClashingNames());
    const paths = processed.paths;

    expect(paths['/search'].get.responses[200].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/DashboardSearchResults'
    );
    expect(paths['/dashboards/{name}/search'].get.responses[200].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/SearchResults'
    );
    expect(processed.components.schemas.SearchResults.properties.items.$ref).toBe('#/components/schemas/ResourceRef');
  });

  it('leaves no $ref pointing at a schema that is not published', () => {
    const processed = processOpenAPISpec(specWithClashingNames());
    const published = new Set(Object.keys(processed.components.schemas));

    const unresolved: string[] = [];
    const collect = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(collect);
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (key === '$ref' && typeof child === 'string') {
            const target = child.split('/').pop()!.replace(/~1/g, '/').replace(/~0/g, '~');
            if (!published.has(target)) {
              unresolved.push(child);
            }
          } else {
            collect(child);
          }
        }
      }
    };
    collect(processed);

    expect(unresolved).toEqual([]);
  });

  it('strips the group, version and namespace from paths', () => {
    const processed = processOpenAPISpec(specWithClashingNames());

    // The '/watch/' path survives, despite what the function's own description says.
    expect(Object.keys(processed.paths).sort()).toEqual(['/dashboards/{name}/search', '/search', '/watch/dashboards']);
    // The namespace parameter is not useful to a client that already knows its own.
    expect(processed.paths['/dashboards/{name}/search'].parameters).toEqual([{ name: 'name', in: 'path' }]);
  });
});
