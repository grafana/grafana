import { type AnnotationEvent } from '@grafana/data';
import { config, type BackendSrv, setBackendSrv } from '@grafana/runtime';

import { annotationEventToSpec, annotationK8sClient, annotationToEvent, buildCreatePayload } from './index';

const postFn = jest.fn();
const putFn = jest.fn();
const patchFn = jest.fn();
const deleteFn = jest.fn();
const getFn = jest.fn();

beforeAll(() => {
  setBackendSrv({
    post: postFn,
    put: putFn,
    patch: patchFn,
    delete: deleteFn,
    get: getFn,
  } as unknown as BackendSrv);

  config.namespace = 'stack-1';
});

beforeEach(() => {
  postFn.mockReset();
  putFn.mockReset();
  patchFn.mockReset();
  deleteFn.mockReset();
  getFn.mockReset();
});

describe('annotationEventToSpec', () => {
  it('omits timeEnd when not a region', () => {
    const event: AnnotationEvent = { time: 100, timeEnd: 100, text: 'hi', isRegion: false };
    const spec = annotationEventToSpec(event);
    expect(spec).toEqual({ text: 'hi', time: 100 });
  });

  it('includes timeEnd when isRegion and timeEnd differs from time', () => {
    const event: AnnotationEvent = { time: 100, timeEnd: 200, text: 'hi', isRegion: true };
    const spec = annotationEventToSpec(event);
    expect(spec.timeEnd).toBe(200);
  });

  it('maps panelId to panelID and dashboardUID', () => {
    const event: AnnotationEvent = {
      time: 100,
      text: 'x',
      panelId: 7,
      dashboardUID: 'dash-1',
      tags: ['a', 'b'],
    };
    const spec = annotationEventToSpec(event);
    expect(spec.panelID).toBe(7);
    expect(spec.dashboardUID).toBe('dash-1');
    expect(spec.tags).toEqual(['a', 'b']);
  });

  it('includes scopes only when provided and non-empty', () => {
    const event: AnnotationEvent = { time: 1, text: 'x' };
    expect(annotationEventToSpec(event).scopes).toBeUndefined();
    expect(annotationEventToSpec(event, []).scopes).toBeUndefined();
    expect(annotationEventToSpec(event, ['scope-a']).scopes).toEqual(['scope-a']);
  });
});

describe('buildCreatePayload', () => {
  it('produces a k8s ResourceForCreate envelope', () => {
    const payload = buildCreatePayload({ time: 100, text: 'hi', panelId: 4, dashboardUID: 'd', tags: ['t'] }, [
      'scope-1',
    ]);
    expect(payload).toEqual({
      apiVersion: 'annotation.grafana.app/v0alpha1',
      kind: 'Annotation',
      metadata: {},
      spec: {
        text: 'hi',
        time: 100,
        panelID: 4,
        dashboardUID: 'd',
        tags: ['t'],
        scopes: ['scope-1'],
      },
    });
  });
});

describe('annotationK8sClient', () => {
  const baseURL = '/apis/annotation.grafana.app/v0alpha1/namespaces/stack-1';

  it('create POSTs to the annotations resource and forwards scopes in spec', async () => {
    postFn.mockResolvedValue({});
    await annotationK8sClient.create({ time: 1, text: 'x' }, ['s1']);

    const [url, body] = postFn.mock.calls[0];
    expect(url).toBe(`${baseURL}/annotations`);
    expect(body.kind).toBe('Annotation');
    expect(body.spec.scopes).toEqual(['s1']);
  });

  it('update PATCHes the spec with merge-patch+json and no preceding GET', async () => {
    patchFn.mockResolvedValue({});

    // Pass the bare numeric ID as the legacy /api/annotations endpoint returns it
    await annotationK8sClient.update(
      { id: '2', time: 2, timeEnd: 5, text: 'new', isRegion: true, panelId: 3, dashboardUID: 'dash-1' },
      ['scope-a']
    );

    expect(getFn).not.toHaveBeenCalled();
    expect(putFn).not.toHaveBeenCalled();

    const [patchUrl, patchBody, patchOpts] = patchFn.mock.calls[0];
    expect(patchUrl).toBe(`${baseURL}/annotations/a-2`);
    expect(patchBody.spec).toMatchObject({
      text: 'new',
      time: 2,
      timeEnd: 5,
      dashboardUID: 'dash-1',
      panelID: 3,
      scopes: ['scope-a'],
    });
    expect(patchOpts.headers['Content-Type']).toBe('application/merge-patch+json');
  });

  it('update accepts an already-prefixed a-{id} name without double-prefixing', async () => {
    patchFn.mockResolvedValue({});
    await annotationK8sClient.update({ id: 'a-2', time: 1, text: 'x' });

    const [patchUrl] = patchFn.mock.calls[0];
    expect(patchUrl).toBe(`${baseURL}/annotations/a-2`);
  });

  it('update clears optional fields by sending explicit nulls', async () => {
    patchFn.mockResolvedValue({});
    await annotationK8sClient.update({ id: '3', time: 5, text: 'x', isRegion: false });

    const [, patchBody] = patchFn.mock.calls[0];
    // Explicit null is required for JSON Merge Patch to remove a field;
    // an omitted field would be a no-op.
    expect(patchBody.spec.timeEnd).toBeNull();
    expect(patchBody.spec.tags).toBeNull();
    expect(patchBody.spec.scopes).toBeNull();
  });

  it('update rejects when id is missing', async () => {
    await expect(annotationK8sClient.update({ time: 1, text: 'x' })).rejects.toThrow();
    expect(patchFn).not.toHaveBeenCalled();
    expect(putFn).not.toHaveBeenCalled();
    expect(getFn).not.toHaveBeenCalled();
  });

  it('remove DELETEs by metadata.name with showSuccessAlert disabled', async () => {
    deleteFn.mockResolvedValue({});
    await annotationK8sClient.remove('3');

    const [delUrl, , delOpts] = deleteFn.mock.calls[0];
    expect(delUrl).toBe(`${baseURL}/annotations/a-3`);
    expect(delOpts).toEqual({ showSuccessAlert: false });
  });

  it('tags hits the custom /tags route and unwraps items', async () => {
    getFn.mockResolvedValue({ tags: [{ tag: 'a', count: 3 }] });
    const tags = await annotationK8sClient.tags();
    expect(getFn).toHaveBeenCalledWith(`${baseURL}/tags`, { limit: 1000 });
    expect(tags).toEqual([{ tag: 'a', count: 3 }]);
  });

  it('tags returns [] when items is missing', async () => {
    getFn.mockResolvedValue({});
    const tags = await annotationK8sClient.tags();
    expect(tags).toEqual([]);
  });

  it('search hits /search, translates params, and unwraps items into AnnotationEvents', async () => {
    getFn.mockResolvedValue({
      kind: 'AnnotationList',
      apiVersion: 'annotation.grafana.app/v0alpha1',
      metadata: {},
      items: [
        {
          apiVersion: 'annotation.grafana.app/v0alpha1',
          kind: 'Annotation',
          metadata: { name: 'a-7', resourceVersion: '1', creationTimestamp: '' },
          spec: { text: 'hi', time: 100, timeEnd: 200, dashboardUID: 'd', panelID: 4, tags: ['t'] },
        },
        {
          apiVersion: 'annotation.grafana.app/v0alpha1',
          kind: 'Annotation',
          metadata: { name: 'a-8', resourceVersion: '1', creationTimestamp: '' },
          spec: { text: 'hello', time: 50 },
        },
      ],
    });

    const events = await annotationK8sClient.search(
      {
        from: 1,
        to: 2,
        limit: 50,
        dashboardUID: 'd',
        panelId: 4,
        tags: ['a', 'b'],
        matchAny: true,
      },
      'req-1'
    );

    expect(getFn).toHaveBeenCalledWith(
      `${baseURL}/search`,
      {
        from: 1,
        to: 2,
        limit: 50,
        dashboardUID: 'd',
        panelID: 4,
        tag: ['a', 'b'],
        tagsMatchAny: true,
      },
      'req-1'
    );

    expect(events).toEqual([
      { id: '7', time: 100, text: 'hi', timeEnd: 200, tags: ['t'], dashboardUID: 'd', panelId: 4 },
      { id: '8', time: 50, text: 'hello' },
    ]);
  });

  it('search omits empty tags/scopes and undefined params from the query string', async () => {
    getFn.mockResolvedValue({ items: [] });
    await annotationK8sClient.search({ from: 1, tags: [], scopes: [] });
    const [, params] = getFn.mock.calls[0];
    expect(params).toEqual({ from: 1 });
  });

  it('search returns [] when items is missing', async () => {
    getFn.mockResolvedValue({});
    expect(await annotationK8sClient.search({})).toEqual([]);
  });
});

describe('annotationToEvent', () => {
  it('strips the a- prefix and returns id as a string', () => {
    const event = annotationToEvent({
      apiVersion: 'annotation.grafana.app/v0alpha1',
      kind: 'Annotation',
      metadata: { name: 'a-42', resourceVersion: '1', creationTimestamp: '' },
      spec: { text: 'x', time: 1 },
    });
    expect(event.id).toBe('42');
  });

  it('keeps the original name when the prefix is absent', () => {
    const event = annotationToEvent({
      apiVersion: 'annotation.grafana.app/v0alpha1',
      kind: 'Annotation',
      metadata: { name: 'foo', resourceVersion: '1', creationTimestamp: '' },
      spec: { text: 'x', time: 1 },
    });
    expect(event.id).toBe('foo');
  });

  it('exposes the createdBy identity ref when present in metadata.annotations', () => {
    const event = annotationToEvent({
      apiVersion: 'annotation.grafana.app/v0alpha1',
      kind: 'Annotation',
      metadata: {
        name: 'a-1',
        annotations: { 'grafana.app/createdBy': 'user:u-001' },
        resourceVersion: '1',
        creationTimestamp: '',
      },
      spec: { text: 'x', time: 1 },
    });
    expect(event.createdBy).toBe('user:u-001');
  });

  it('omits createdBy when metadata.annotations is missing the key', () => {
    const event = annotationToEvent({
      apiVersion: 'annotation.grafana.app/v0alpha1',
      kind: 'Annotation',
      metadata: { name: 'a-1', resourceVersion: '1', creationTimestamp: '' },
      spec: { text: 'x', time: 1 },
    });
    expect(event.createdBy).toBeUndefined();
  });
});
