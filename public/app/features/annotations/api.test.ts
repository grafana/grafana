import { type BackendSrv, config, setBackendSrv } from '@grafana/runtime';

import { annotationServer, resetAnnotationServerForTests } from './api';

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
  resetAnnotationServerForTests();
});

describe('annotationServer with kubernetesAnnotations toggle OFF', () => {
  beforeAll(() => {
    config.featureToggles.kubernetesAnnotations = false;
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

describe('annotationServer with kubernetesAnnotations toggle ON', () => {
  const baseURL = '/apis/annotation.grafana.app/v0alpha1/namespaces/stack-1';

  beforeAll(() => {
    config.featureToggles.kubernetesAnnotations = true;
    config.namespace = 'stack-1';
  });

  afterAll(() => {
    config.featureToggles.kubernetesAnnotations = false;
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
      metadata: { name: 'name-1', resourceVersion: 'rv-7', creationTimestamp: '' },
      spec: { text: 'old', time: 1 },
    });
    putFn.mockResolvedValue({});

    await annotationServer().update({ id: 'name-1', time: 2, text: 'new' }, ['scope-a']);

    expect(getFn).toHaveBeenCalledWith(`${baseURL}/annotations/name-1`);

    const [putUrl, body] = putFn.mock.calls[0];
    expect(putUrl).toBe(`${baseURL}/annotations/name-1`);
    expect(body.metadata.name).toBe('name-1');
    expect(body.metadata.resourceVersion).toBe('rv-7');
    expect(body.spec.scopes).toEqual(['scope-a']);
    expect(body.spec.text).toBe('new');
  });

  it('delete DELETEs the k8s resource by metadata.name', async () => {
    deleteFn.mockResolvedValue({});
    await annotationServer().delete({ id: 'name-1' });

    const [url, , opts] = deleteFn.mock.calls[0];
    expect(url).toBe(`${baseURL}/annotations/name-1`);
    expect(opts).toEqual({ showSuccessAlert: false });
  });

  it('tags hits the custom k8s /tags route and maps to {term,count}', async () => {
    getFn.mockResolvedValue({ items: [{ name: 'a', count: 3 }] });
    const tags = await annotationServer().tags();
    expect(getFn).toHaveBeenCalledWith(`${baseURL}/tags`, { limit: 1000 });
    expect(tags).toEqual([{ term: 'a', count: 3 }]);
  });

  it('query stays on the legacy /api/annotations endpoint', async () => {
    getFn.mockResolvedValue([]);
    await annotationServer().query({ from: 1 }, 'req-1');
    expect(getFn).toHaveBeenCalledWith('/api/annotations', { from: 1 }, 'req-1');
  });

  it('forAlert stays on the legacy /api/annotations endpoint', async () => {
    getFn.mockResolvedValue([]);
    await annotationServer().forAlert('alert-1');
    expect(getFn).toHaveBeenCalledWith('/api/annotations', { alertUID: 'alert-1' });
  });
});
