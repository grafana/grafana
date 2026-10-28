import config, { withoutPerResourceSearch, type OperationDefinition } from './generate-rtk-apis';

const operation = (path: string, verb: OperationDefinition['verb'] = 'post') => ({ path, verb }) as OperationDefinition;

describe('withoutPerResourceSearch', () => {
  const filter = withoutPerResourceSearch();
  const include = (path: string, verb?: OperationDefinition['verb']) =>
    typeof filter === 'function' ? filter('anyName', operation(path, verb)) : false;

  it('drops the per-resource search and trash endpoints', () => {
    expect(include('/dashboards/search')).toBe(false);
    expect(include('/users/trash')).toBe(false);
  });

  it('keeps the allowlisted folder search, but not its hybrid variant', () => {
    expect(include('/folders/search')).toBe(true);
    expect(include('/folders/search/hybrid')).toBe(false);
  });

  // The dashboard search at the group root is a different, older endpoint that the
  // frontend does call.
  it('keeps the group-root search', () => {
    expect(include('/search')).toBe(true);
    expect(include('/search/sortable')).toBe(true);
  });

  it('keeps the legacy hybrid GET while excluding per-resource hybrid search', () => {
    expect(include('/search/hybrid', 'get')).toBe(true);
    expect(include('/dashboards/search/hybrid')).toBe(false);
    expect(include('/folders/search/hybrid')).toBe(false);
  });

  it('keeps everything else', () => {
    expect(include('/dashboards')).toBe(true);
    expect(include('/dashboards/{name}')).toBe(true);
    expect(include('/dashboards/trash/hybrid')).toBe(true);
    expect(include('/dashboards/search/hybrid/other')).toBe(true);
    expect(include('/namespaces/{namespace}/dashboards/search/other')).toBe(true);
  });

  it('leaves a whitelist alone, since it already excludes what it does not name', () => {
    expect(withoutPerResourceSearch(['getSession'])).toEqual(['getSession']);
  });

  it('keeps a caller-supplied filter as well as its own', () => {
    const onlyDashboards = withoutPerResourceSearch((_name, op) => op.path.startsWith('/dashboards'));
    if (typeof onlyDashboards !== 'function') {
      throw new Error('expected a function');
    }

    expect(onlyDashboards('anyName', operation('/dashboards'))).toBe(true);
    expect(onlyDashboards('anyName', operation('/folders'))).toBe(false);
    expect(onlyDashboards('anyName', operation('/dashboards/search'))).toBe(false);
    expect(onlyDashboards('anyName', operation('/dashboards/search/hybrid'))).toBe(false);
  });
});

describe('dashboard search configuration', () => {
  if (!('outputFiles' in config)) {
    throw new Error('expected output files');
  }
  const apiConfig = config.outputFiles['../clients/rtkq/dashboard/v0alpha1/endpoints.gen.ts'];

  it('includes all routes in the configured dashboard client', () => {
    expect(apiConfig).toMatchObject({
      apiFile: '../clients/rtkq/dashboard/v0alpha1/baseAPI.ts',
      tag: true,
    });
    expect(apiConfig.filterEndpoints).toBeUndefined();
  });

  it.each([
    ['/dashboards/search', 'post', true],
    ['/dashboards/search/hybrid', 'post', true],
    ['/dashboards/trash', 'post', true],
    ['/dashboards', 'post', false],
    ['/search/hybrid', 'get', false],
  ] as const)('overrides %s %s as a query: %s', (path, verb, overridden) => {
    const override = apiConfig.endpointOverrides?.[0];
    expect(override?.type).toBe('query');
    if (typeof override?.pattern !== 'function') {
      throw new Error('expected an endpoint matcher');
    }
    expect(override.pattern('anyName', operation(path, verb))).toBe(overridden);
  });
});

describe('folder search configuration', () => {
  if (!('outputFiles' in config)) {
    throw new Error('expected output files');
  }
  const apiConfig = config.outputFiles['../clients/rtkq/folder/v1beta1/endpoints.gen.ts'];

  it.each([
    ['/folders/search', 'post', true],
    ['/folders', 'post', false],
    ['/folders/search', 'get', false],
  ] as const)('overrides %s %s as a query: %s', (path, verb, overridden) => {
    const override = apiConfig.endpointOverrides?.[0];
    expect(override?.type).toBe('query');
    if (typeof override?.pattern !== 'function') {
      throw new Error('expected an endpoint matcher');
    }
    expect(override.pattern('anyName', operation(path, verb))).toBe(overridden);
  });
});
