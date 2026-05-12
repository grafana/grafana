import { type BackendSrv, config, setBackendSrv } from '@grafana/runtime';

import { getAPIGroupDiscoveryList } from '../apiserver/discovery';

import { annotationServer } from './api';

jest.mock('../apiserver/discovery');

const mockGetAPIGroupDiscoveryList = jest.mocked(getAPIGroupDiscoveryList);

const postFn = jest.fn();
const putFn = jest.fn();
const patchFn = jest.fn();
const deleteFn = jest.fn();
const getFn = jest.fn();

const apiGroupAvailable = {
  metadata: { resourceVersion: '' },
  items: [{ metadata: { name: 'annotation.grafana.app' }, versions: [] }],
};
const apiGroupMissing = { metadata: { resourceVersion: '' }, items: [] };

beforeAll(() => {
  setBackendSrv({
    post: postFn,
    put: putFn,
    patch: patchFn,
    delete: deleteFn,
    get: getFn,
  } as unknown as BackendSrv);
});

beforeEach(() => {
  postFn.mockReset();
  putFn.mockReset();
  patchFn.mockReset();
  deleteFn.mockReset();
  getFn.mockReset();
  mockGetAPIGroupDiscoveryList.mockReset();
});

describe('annotationServer with FE flag OFF', () => {
  beforeAll(() => {
    config.featureToggles.kubernetesAnnotationsClient = false;
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

  it('does not call /apis discovery when FE flag is off', async () => {
    await annotationServer().save({ time: 1, text: 'x', dashboardUID: 'd', panelId: 1 });
    expect(mockGetAPIGroupDiscoveryList).not.toHaveBeenCalled();
  });
});

describe('annotationServer falls back to legacy when API group is not discovered', () => {
  beforeAll(() => {
    config.featureToggles.kubernetesAnnotationsClient = true;
    config.namespace = 'stack-1';
  });

  afterAll(() => {
    config.featureToggles.kubernetesAnnotationsClient = false;
  });

  it('FE FF on, API group missing in /apis → legacy', async () => {
    mockGetAPIGroupDiscoveryList.mockResolvedValue(apiGroupMissing);
    await annotationServer().save({ time: 1, text: 'x', dashboardUID: 'd', panelId: 1 });
    expect(postFn).toHaveBeenCalledWith('/api/annotations', expect.objectContaining({ time: 1 }));
  });

  it('discovery rejection is treated as legacy', async () => {
    mockGetAPIGroupDiscoveryList.mockRejectedValue(new Error('boom'));
    await annotationServer().save({ time: 1, text: 'x', dashboardUID: 'd', panelId: 1 });
    expect(postFn).toHaveBeenCalledWith('/api/annotations', expect.objectContaining({ time: 1 }));
  });
});

describe('annotationServer with FE flag ON and API group discovered', () => {
  const baseURL = '/apis/annotation.grafana.app/v0alpha1/namespaces/stack-1';

  beforeAll(() => {
    config.featureToggles.kubernetesAnnotationsClient = true;
    config.namespace = 'stack-1';
  });

  afterAll(() => {
    config.featureToggles.kubernetesAnnotationsClient = false;
  });

  beforeEach(() => {
    mockGetAPIGroupDiscoveryList.mockResolvedValue(apiGroupAvailable);
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

  it('update PATCHes the k8s resource without a preceding GET', async () => {
    patchFn.mockResolvedValue({});

    // Bare numeric id as returned by legacy /api/annotations
    await annotationServer().update({ id: '1', time: 2, text: 'new' }, ['scope-a']);

    expect(getFn).not.toHaveBeenCalled();

    const [patchUrl, body, opts] = patchFn.mock.calls[0];
    expect(patchUrl).toBe(`${baseURL}/annotations/a-1`);
    expect(body.spec.text).toBe('new');
    expect(body.spec.time).toBe(2);
    expect(body.spec.scopes).toEqual(['scope-a']);
    expect(opts.headers['Content-Type']).toBe('application/merge-patch+json');
  });

  it('update clears optional fields by sending explicit nulls', async () => {
    patchFn.mockResolvedValue({});
    await annotationServer().update({ id: '1', time: 2, text: 'new' });

    const [, body] = patchFn.mock.calls[0];
    expect(body.spec.timeEnd).toBeNull();
    expect(body.spec.tags).toBeNull();
    expect(body.spec.scopes).toBeNull();
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

  it('query hits the k8s /search sub-resource and merges legacy alert annotations', async () => {
    getFn.mockImplementation((url: string) => {
      if (url === `${baseURL}/search`) {
        return Promise.resolve({
          kind: 'AnnotationList',
          apiVersion: 'annotation.grafana.app/v0alpha1',
          metadata: {},
          items: [
            {
              apiVersion: 'annotation.grafana.app/v0alpha1',
              kind: 'Annotation',
              metadata: { name: 'a-7', resourceVersion: '1', creationTimestamp: '' },
              spec: { text: 'manual', time: 100, dashboardUID: 'd' },
            },
          ],
        });
      }
      if (url === '/api/annotations') {
        return Promise.resolve([{ id: 9, text: 'alerting', time: 200, dashboardUID: 'd', newState: 'alerting' }]);
      }
      return Promise.resolve(null);
    });

    const frame = await annotationServer().query(
      { from: 1, to: 2, dashboardUID: 'd', limit: 100, matchAny: false, scopes: ['s-1'] },
      'req-1'
    );

    expect(getFn).toHaveBeenCalledWith(
      `${baseURL}/search`,
      { from: 1, to: 2, dashboardUID: 'd', limit: 100, tagsMatchAny: false, scope: ['s-1'] },
      'req-1'
    );
    expect(getFn).toHaveBeenCalledWith(
      '/api/annotations',
      { from: 1, to: 2, dashboardUID: 'd', limit: 100, matchAny: false, type: 'alert' },
      'req-1-alert'
    );
    expect(frame.length).toBe(2);
    const texts = frame.fields.find((f) => f.name === 'text')?.values;
    expect(texts).toEqual(['manual', 'alerting']);
  });

  it('query skips the alert fetch when caller explicitly filters to type=annotation', async () => {
    getFn.mockResolvedValue({ kind: 'AnnotationList', items: [] });
    await annotationServer().query({ from: 1, to: 2, dashboardUID: 'd', type: 'annotation' }, 'req-1');

    expect(getFn).toHaveBeenCalledTimes(1);
    expect(getFn).toHaveBeenCalledWith(`${baseURL}/search`, expect.any(Object), 'req-1');
  });

  it('forAlert stays on the legacy /api/annotations endpoint', async () => {
    getFn.mockResolvedValue([]);
    await annotationServer().forAlert('alert-1');
    expect(getFn).toHaveBeenCalledWith('/api/annotations', { alertUID: 'alert-1' });
  });
});
