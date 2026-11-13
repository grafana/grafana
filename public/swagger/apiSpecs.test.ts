import { buildSpecs, compareVersions, grafanaGroup, loadSpecs } from './apiSpecs';

function paths(...groupVersions: string[]) {
  return Object.fromEntries(
    groupVersions.map((gv) => [`apis/${gv}`, { serverRelativeURL: `/openapi/v3/apis/${gv}?hash=abc` }])
  );
}

describe('compareVersions', () => {
  it('orders stable before beta before alpha, newest first within each', () => {
    const versions = ['v0alpha1', 'v1beta1', 'v2alpha1', 'v1', 'v2beta1', 'v2', 'v1alpha2'];

    expect(versions.sort(compareVersions)).toEqual([
      'v2',
      'v1',
      'v2beta1',
      'v1beta1',
      'v2alpha1',
      'v1alpha2',
      'v0alpha1',
    ]);
  });

  it('puts versions that do not follow Kubernetes naming last, sorted by name', () => {
    expect(['latest', 'v1', 'edge'].sort(compareVersions)).toEqual(['v1', 'edge', 'latest']);
  });
});

describe('buildSpecs', () => {
  it('lists the Grafana specs first, then sorts by API group, setting a group only when there are several versions', () => {
    const specs = buildSpecs(
      paths('folder.grafana.app/v1', 'dashboard.grafana.app/v0alpha1', 'dashboard.grafana.app/v1')
    );

    expect(specs.map((s) => [s.group, s.key])).toEqual([
      [grafanaGroup, 'openapi2'],
      [grafanaGroup, 'openapi3'],
      ['dashboard.grafana.app', 'dashboard.grafana.app-v1'],
      ['dashboard.grafana.app', 'dashboard.grafana.app-v0alpha1'],
      [undefined, 'folder.grafana.app-v1'],
    ]);
  });

  it('keeps the label, key and relative URL that ?api= links and SwaggerUI rely on', () => {
    const [spec] = buildSpecs(paths('iam.grafana.app/v0alpha1')).slice(2);

    expect(spec).toMatchObject({
      key: 'iam.grafana.app-v0alpha1',
      label: 'iam.grafana.app/v0alpha1',
      url: 'openapi/v3/apis/iam.grafana.app/v0alpha1?hash=abc',
      version: 'v0alpha1',
    });
  });

  it('ignores index entries that are not an API group version', () => {
    const specs = buildSpecs({ ...paths('folder.grafana.app/v1'), api: { serverRelativeURL: '/openapi/v3/api' } });

    expect(specs.map((s) => s.key)).toEqual(['openapi2', 'openapi3', 'folder.grafana.app-v1']);
  });

  it('marks the preferred version reported by the API server', () => {
    const specs = buildSpecs(paths('dashboard.grafana.app/v1', 'dashboard.grafana.app/v2beta1'), {
      groups: [{ name: 'dashboard.grafana.app', preferredVersion: { version: 'v1' } }],
    });

    expect(specs.filter((s) => s.preferred).map((s) => s.key)).toEqual(['dashboard.grafana.app-v1']);
  });

  it('does not mark the preferred version of a group with a single version', () => {
    const specs = buildSpecs(paths('folder.grafana.app/v1'), {
      groups: [{ name: 'folder.grafana.app', preferredVersion: { version: 'v1' } }],
    });

    expect(specs.some((s) => s.preferred)).toBe(false);
  });

  it('marks no version preferred when discovery is unavailable', () => {
    const specs = buildSpecs(paths('dashboard.grafana.app/v1', 'dashboard.grafana.app/v0alpha1'));

    expect(specs.some((s) => s.preferred)).toBe(false);
  });

  it('supersedes alpha and beta versions only in groups that have a stable version', () => {
    const specs = buildSpecs(
      paths(
        'dashboard.grafana.app/v0alpha1',
        'dashboard.grafana.app/v1beta1',
        'dashboard.grafana.app/v1',
        'iam.grafana.app/v0alpha1',
        'iam.grafana.app/v1beta1'
      )
    );

    expect(Object.fromEntries(specs.slice(2).map((s) => [s.key, s.superseded]))).toEqual({
      'dashboard.grafana.app-v1': false,
      'dashboard.grafana.app-v1beta1': true,
      'dashboard.grafana.app-v0alpha1': true,
      'iam.grafana.app-v1beta1': false,
      'iam.grafana.app-v0alpha1': false,
    });
  });
});

describe('loadSpecs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('combines the OpenAPI index with discovery', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) =>
        url === 'apis'
          ? new Response(JSON.stringify({ groups: [{ name: 'a.grafana.app', preferredVersion: { version: 'v1' } }] }))
          : new Response(JSON.stringify({ paths: paths('a.grafana.app/v1', 'a.grafana.app/v0alpha1') }))
      );

    const specs = await loadSpecs();

    expect(specs.find((s) => s.preferred)?.key).toBe('a.grafana.app-v1');
  });

  it.each([
    ['is rejected', () => Promise.resolve(new Response('Unauthorized', { status: 401 }))],
    ['is not JSON', () => Promise.resolve(new Response('404 page not found'))],
    ['fails on the network', () => Promise.reject(new Error('offline'))],
  ])('still lists the Grafana specs when the request %s', async (_, response) => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(response);

    const specs = await loadSpecs();

    expect(specs.map((s) => s.key)).toEqual(['openapi2', 'openapi3']);
  });
});
