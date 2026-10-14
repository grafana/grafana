import config, { createAPIConfig, createAPIConfigWithSearch, type OperationDefinition } from './generate-rtk-apis';

const operation = (path: string, verb: OperationDefinition['verb'] = 'post') => ({ path, verb }) as OperationDefinition;
const outputFile = '../clients/rtkq/dashboard/v0alpha1/endpoints.gen.ts';

describe('createAPIConfig', () => {
  const apiConfig = createAPIConfig('dashboard', 'v0alpha1')[outputFile];

  it.each([
    ['/dashboards/search', false],
    ['/folders/search', false],
    ['/users/trash', false],
    ['/dashboards/search/hybrid', false],
    ['/folders/search/hybrid', false],
    ['/search', true],
    ['/search/sortable', true],
    ['/search/hybrid', true],
    ['/dashboards', true],
    ['/dashboards/{name}', true],
    ['/dashboards/trash/hybrid', true],
    ['/dashboards/search/hybrid/other', true],
  ])('filters %s with inclusion=%s', (path, included) => {
    expect(apiConfig.filterEndpoints('anyName', operation(path))).toBe(included);
  });
});

describe('createAPIConfigWithSearch', () => {
  const apiConfig = createAPIConfigWithSearch('dashboard', 'v0alpha1')[outputFile];

  it('includes all routes in the configured dashboard client', () => {
    if (!('outputFiles' in config)) {
      throw new Error('expected output files');
    }
    expect(config.outputFiles[outputFile]).toMatchObject({
      apiFile: '../clients/rtkq/dashboard/v0alpha1/baseAPI.ts',
      tag: true,
    });
    expect(config.outputFiles[outputFile].filterEndpoints).toBeUndefined();
  });

  it.each(['/dashboards/search', '/dashboards/search/hybrid', '/dashboards/trash'])(
    'generates POST %s as a query',
    (path) => {
      const override = apiConfig.endpointOverrides[0];
      expect(override.pattern('anyName', operation(path))).toBe(true);
      expect(override.type).toBe('query');
    }
  );

  it('does not override writes or legacy GET queries', () => {
    const override = apiConfig.endpointOverrides[0];
    expect(override.type).toBe('query');
    expect(override.pattern('createDashboard', operation('/dashboards'))).toBe(false);
    expect(override.pattern('hybridSearchDashboards', operation('/search/hybrid', 'get'))).toBe(false);
  });
});
