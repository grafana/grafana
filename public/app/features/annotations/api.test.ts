import { type BackendSrv, config, setBackendSrv } from '@grafana/runtime';

import { annotationServer } from './api';

const postFn = jest.fn();
const putFn = jest.fn();
const deleteFn = jest.fn();
const getFn = jest.fn();

beforeAll(() => {
  setBackendSrv({
    post: postFn,
    put: putFn,
    delete: deleteFn,
    get: getFn,
  } as unknown as BackendSrv);
});

beforeEach(() => {
  postFn.mockReset();
  putFn.mockReset();
  deleteFn.mockReset();
  getFn.mockReset();
});

describe('annotationServer with both gates OFF', () => {
  beforeAll(() => {
    config.featureToggles.kubernetesAnnotationsClient = false;
    config.annotationAppPlatformEnabled = false;
    config.namespace = 'stack-1';
  });

  it('save POSTs to legacy /api/annotations', async () => {
    await annotationServer().save({ time: 1, text: 'x', dashboardUID: 'd', panelId: 1 });
    expect(postFn).toHaveBeenCalledWith('/api/annotations', expect.objectContaining({ time: 1 }));
  });

  it('update PUTs to legacy /api/annotations/:id', async () => {
    await annotationServer().update({ id: '42', time: 1, text: 'x' });
    expect(putFn).toHaveBeenCalledWith('/api/annotations/42', expect.objectContaining({ id: '42' }));
  });

  it('delete DELETEs the legacy resource', async () => {
    await annotationServer().delete({ id: '42' });
    expect(deleteFn).toHaveBeenCalledWith('/api/annotations/42');
  });

  it('tags reads from legacy /api/annotations/tags', async () => {
    getFn.mockResolvedValue({ result: { tags: [{ tag: 't', count: 2 }] } });
    const tags = await annotationServer().tags();
    expect(getFn).toHaveBeenCalledWith('/api/annotations/tags?limit=1000');
    expect(tags).toEqual([{ term: 't', count: 2 }]);
  });
});

describe('annotationServer with only one gate ON falls back to legacy', () => {
  afterEach(() => {
    config.featureToggles.kubernetesAnnotationsClient = false;
    config.annotationAppPlatformEnabled = false;
  });

  it('FE FF on, backend platform off → legacy', async () => {
    config.featureToggles.kubernetesAnnotationsClient = true;
    config.annotationAppPlatformEnabled = false;
    await annotationServer().save({ time: 1, text: 'x', dashboardUID: 'd', panelId: 1 });
    expect(postFn).toHaveBeenCalledWith('/api/annotations', expect.objectContaining({ time: 1 }));
  });

  it('FE FF off, backend platform on → legacy', async () => {
    config.featureToggles.kubernetesAnnotationsClient = false;
    config.annotationAppPlatformEnabled = true;
    await annotationServer().save({ time: 1, text: 'x', dashboardUID: 'd', panelId: 1 });
    expect(postFn).toHaveBeenCalledWith('/api/annotations', expect.objectContaining({ time: 1 }));
  });
});

describe('annotationServer with both gates ON', () => {
  const baseURL = '/apis/annotation.grafana.app/v0alpha1/namespaces/stack-1';

  beforeAll(() => {
    config.featureToggles.kubernetesAnnotationsClient = true;
    config.annotationAppPlatformEnabled = true;
    config.namespace = 'stack-1';
  });

  afterAll(() => {
    config.featureToggles.kubernetesAnnotationsClient = false;
    config.annotationAppPlatformEnabled = false;
  });

  it('save POSTs to the k8s endpoint and includes spec.scopes', async () => {
    postFn.mockResolvedValue({});
    await annotationServer().save({ time: 1, text: 'x', dashboardUID: 'd', panelId: 1 }, ['scope-1', 'scope-2']);

    const [url, body] = postFn.mock.calls[0];
    expect(url).toBe(`${baseURL}/annotations`);
    expect(body.kind).toBe('Annotation');
    expect(body.spec.scopes).toEqual(['scope-1', 'scope-2']);
    expect(body.spec.dashboardUID).toBe('d');
    expect(body.spec.panelID).toBe(1);
  });

  it('update fetches existing then PUTs back with scopes and resourceVersion preserved', async () => {
    getFn.mockResolvedValue({
      apiVersion: 'annotation.grafana.app/v0alpha1',
      kind: 'Annotation',
      metadata: { name: 'a-1', resourceVersion: 'rv-7', creationTimestamp: '' },
      spec: { text: 'old', time: 1 },
    });
    putFn.mockResolvedValue({});

    // Bare numeric id as returned by legacy /api/annotations
    await annotationServer().update({ id: '1', time: 2, text: 'new' }, ['scope-a']);

    expect(getFn).toHaveBeenCalledWith(`${baseURL}/annotations/a-1`);

    const [putUrl, body] = putFn.mock.calls[0];
    expect(putUrl).toBe(`${baseURL}/annotations/a-1`);
    expect(body.metadata.name).toBe('a-1');
    expect(body.metadata.resourceVersion).toBe('rv-7');
    expect(body.spec.scopes).toEqual(['scope-a']);
    expect(body.spec.text).toBe('new');
  });

  it('delete DELETEs the k8s resource by metadata.name', async () => {
    deleteFn.mockResolvedValue({});
    await annotationServer().delete({ id: '1' });

    const [url, , opts] = deleteFn.mock.calls[0];
    expect(url).toBe(`${baseURL}/annotations/a-1`);
    expect(opts).toEqual({ showSuccessAlert: false });
  });

  it('tags hits the custom k8s /tags route and maps to {term,count}', async () => {
    getFn.mockResolvedValue({ tags: [{ tag: 'a', count: 3 }] });
    const tags = await annotationServer().tags();
    expect(getFn).toHaveBeenCalledWith(`${baseURL}/tags`, { limit: 1000 });
    expect(tags).toEqual([{ term: 'a', count: 3 }]);
  });

  it('query hits the k8s /search sub-resource and returns a DataFrame', async () => {
    getFn.mockResolvedValue({
      kind: 'AnnotationList',
      apiVersion: 'annotation.grafana.app/v0alpha1',
      metadata: {},
      items: [
        {
          apiVersion: 'annotation.grafana.app/v0alpha1',
          kind: 'Annotation',
          metadata: { name: 'a-7', resourceVersion: '1', creationTimestamp: '' },
          spec: { text: 'hi', time: 100, dashboardUID: 'd' },
        },
      ],
    });

    const frame = await annotationServer().query(
      { from: 1, to: 2, dashboardUID: 'd', limit: 100, matchAny: false },
      'req-1'
    );

    expect(getFn).toHaveBeenCalledWith(
      `${baseURL}/search`,
      { from: 1, to: 2, dashboardUID: 'd', limit: 100, tagsMatchAny: false },
      'req-1'
    );
    expect(frame.length).toBe(1);
    expect(frame.fields.find((f) => f.name === 'id')?.values[0]).toBe('7');
    expect(frame.fields.find((f) => f.name === 'text')?.values[0]).toBe('hi');
  });

  it('forAlert stays on the legacy /api/annotations endpoint', async () => {
    getFn.mockResolvedValue([]);
    await annotationServer().forAlert('alert-1');
    expect(getFn).toHaveBeenCalledWith('/api/annotations', { alertUID: 'alert-1' });
  });
});
