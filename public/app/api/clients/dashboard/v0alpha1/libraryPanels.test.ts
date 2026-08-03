import { of } from 'rxjs';

import { type BackendSrv, setBackendSrv } from '@grafana/runtime';

import {
  k8sResourceToLegacyDTO,
  k8sResourceToLegacyModel,
  legacyModelToSpecAndStatus,
  libraryPanelsK8sClient,
  type LibraryPanelResource,
} from './libraryPanels';

jest.mock('app/api/utils', () => ({
  getAPIBaseURL: (group: string, version: string) => `/apis/${group}/${version}`,
  getAPINamespace: () => 'default',
}));

function makeResource(overrides: Partial<LibraryPanelResource> = {}): LibraryPanelResource {
  return {
    apiVersion: 'dashboard.grafana.app/v0alpha1',
    kind: 'LibraryPanel',
    metadata: {
      name: 'panel-uid',
      resourceVersion: '1',
      generation: 3,
      creationTimestamp: '2024-01-01T00:00:00Z',
      annotations: {
        'grafana.app/folder': 'folder-uid',
        'grafana.app/updatedTimestamp': '2024-02-02T00:00:00Z',
      },
    },
    spec: {
      type: 'timeseries',
      title: 'My library panel',
      panelTitle: 'Panel display title',
      description: 'A description',
      options: { hello: 'options' },
      fieldConfig: { defaults: {} },
    },
    status: {
      missing: { transformations: [{ id: 'reduce' }], maxDataPoints: 100 },
    },
    ...overrides,
  };
}

describe('legacyModelToSpecAndStatus', () => {
  it('maps the model title to panelTitle and the name to title', () => {
    const { spec } = legacyModelToSpecAndStatus('My library panel', {
      type: 'timeseries',
      title: 'Panel display title',
    });

    expect(spec.title).toBe('My library panel');
    expect(spec.panelTitle).toBe('Panel display title');
    expect(spec.type).toBe('timeseries');
  });

  it('keeps model properties without a typed spec field in status.missing', () => {
    const { spec, status } = legacyModelToSpecAndStatus('name', {
      type: 'timeseries',
      title: 'title',
      options: { a: 1 },
      fieldConfig: { defaults: {} },
      gridPos: { x: 0, y: 0, w: 12, h: 8 },
      links: [{ title: 'link' }],
      transparent: true,
      id: 4,
      libraryPanel: { uid: 'x', name: 'name' },
      transformations: [{ id: 'reduce' }],
      maxDataPoints: 100,
    });

    expect(status.missing).toEqual({ transformations: [{ id: 'reduce' }], maxDataPoints: 100 });
    expect(spec.gridPos).toEqual({ x: 0, y: 0, w: 12, h: 8 });
  });

  it('does not retain typed values in status.missing after they are cleared', () => {
    const { spec, status } = legacyModelToSpecAndStatus('name', {
      type: 'timeseries',
      title: 'title',
      links: [{ title: 'link' }],
      transparent: true,
    });

    spec.links = undefined;
    spec.transparent = false;

    expect(k8sResourceToLegacyModel(makeResource({ spec, status }))).not.toMatchObject({
      links: expect.anything(),
      transparent: expect.anything(),
    });
  });
});

describe('k8sResourceToLegacyModel', () => {
  it('rebuilds the legacy model including properties preserved in status.missing', () => {
    const model = k8sResourceToLegacyModel(makeResource());

    expect(model).toEqual({
      type: 'timeseries',
      title: 'Panel display title',
      description: 'A description',
      options: { hello: 'options' },
      fieldConfig: { defaults: {} },
      transformations: [{ id: 'reduce' }],
      maxDataPoints: 100,
    });
  });

  it('round trips with legacyModelToSpecAndStatus', () => {
    const original = {
      type: 'timeseries',
      title: 'Panel display title',
      description: 'A description',
      options: { hello: 'options' },
      fieldConfig: { defaults: {} },
      transparent: true,
      transformations: [{ id: 'reduce' }],
    };

    const { spec, status } = legacyModelToSpecAndStatus('My library panel', original);
    const rebuilt = k8sResourceToLegacyModel(makeResource({ spec, status }));

    expect(rebuilt).toEqual(original);
  });
});

describe('k8sResourceToLegacyDTO', () => {
  it('maps k8s metadata onto the legacy DTO shape', () => {
    const dto = k8sResourceToLegacyDTO(makeResource(), { folderName: 'My folder', connectedDashboards: 2 });

    expect(dto.uid).toBe('panel-uid');
    expect(dto.name).toBe('My library panel');
    expect(dto.type).toBe('timeseries');
    expect(dto.description).toBe('A description');
    expect(dto.folderUid).toBe('folder-uid');
    expect(dto.version).toBe(3);
    expect(dto.meta).toMatchObject({
      folderName: 'My folder',
      folderUid: 'folder-uid',
      connectedDashboards: 2,
      created: '2024-01-01T00:00:00Z',
      updated: '2024-02-02T00:00:00Z',
    });
  });

  it('falls back to the creation timestamp when never updated', () => {
    const resource = makeResource();
    delete resource.metadata.annotations!['grafana.app/updatedTimestamp'];

    const dto = k8sResourceToLegacyDTO(resource);

    expect(dto.meta?.updated).toBe('2024-01-01T00:00:00Z');
  });

  it('uses the legacy root folder name for root-level panels', () => {
    const resource = makeResource();
    delete resource.metadata.annotations!['grafana.app/folder'];

    const dto = k8sResourceToLegacyDTO(resource);

    expect(dto.meta?.folderName).toBe('General');
    expect(dto.meta?.folderUid).toBe('');
  });
});

describe('libraryPanelsK8sClient request options', () => {
  const fetch = jest.fn();
  const get = jest.fn();
  const put = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setBackendSrv({ fetch, get, put } as unknown as BackendSrv);
  });

  it('forwards the abort signal through pagination and folder resolution', async () => {
    const rootResource = makeResource();
    delete rootResource.metadata.annotations!['grafana.app/folder'];
    const folderResource = makeResource({
      metadata: {
        ...makeResource().metadata,
        name: 'second-panel',
      },
    });
    fetch.mockImplementation(({ url, params }) => {
      if (url.endsWith('/librarypanels') && !params?.continue) {
        return of({
          data: { metadata: { resourceVersion: '1', continue: 'next' }, items: [rootResource] },
        });
      }
      if (url.endsWith('/librarypanels')) {
        return of({
          data: { metadata: { resourceVersion: '1' }, items: [folderResource] },
        });
      }
      if (url.endsWith('/folders/folder-uid')) {
        return of({ data: { spec: { title: 'Folder' } } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const controller = new AbortController();

    const result = await libraryPanelsK8sClient.list({ signal: controller.signal });

    expect(result.elements).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.map(([options]) => options)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringMatching(/\/librarypanels$/),
          abortSignal: controller.signal,
          showErrorAlert: false,
        }),
        expect.objectContaining({
          url: expect.stringMatching(/\/folders\/folder-uid$/),
          abortSignal: controller.signal,
          showErrorAlert: false,
        }),
      ])
    );
  });

  it('suppresses get alerts when the caller handles errors', async () => {
    const resource = makeResource();
    delete resource.metadata.annotations!['grafana.app/folder'];
    fetch.mockReturnValue(of({ data: resource }));
    get.mockResolvedValue({ result: [] });

    await libraryPanelsK8sClient.get('panel-uid', true);

    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ showSuccessAlert: false, showErrorAlert: false }));
  });

  it('does not match root panels by the synthetic General folder name', async () => {
    const resource = makeResource();
    delete resource.metadata.annotations!['grafana.app/folder'];
    fetch.mockReturnValue(
      of({
        data: { metadata: { resourceVersion: '1' }, items: [resource] },
      })
    );

    const result = await libraryPanelsK8sClient.list({ searchString: 'general' });

    expect(result.totalCount).toBe(0);
    expect(result.elements).toEqual([]);
  });

  it('uses the current resource version when updating', async () => {
    const resource = makeResource({
      metadata: {
        ...makeResource().metadata,
        resourceVersion: '42',
      },
    });
    get.mockImplementation((url: string) =>
      url.startsWith('/apis/') ? Promise.resolve(resource) : Promise.resolve({ result: [] })
    );
    put.mockResolvedValue(resource);
    fetch.mockReturnValue(of({ data: resource }));

    await libraryPanelsK8sClient.update('panel-uid', 'Updated name', resource.spec, 3, 'folder-uid');

    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/\/librarypanels\/panel-uid$/),
      expect.objectContaining({
        metadata: expect.objectContaining({
          generation: 3,
          resourceVersion: '42',
        }),
      }),
      { params: undefined }
    );
  });

  it('rejects an update when the legacy version is stale', async () => {
    const resource = makeResource({
      metadata: {
        ...makeResource().metadata,
        generation: 4,
      },
    });
    get.mockResolvedValue(resource);

    await expect(libraryPanelsK8sClient.update('panel-uid', 'Updated name', resource.spec, 3)).rejects.toThrow(
      'Library panel version mismatch'
    );
    expect(put).not.toHaveBeenCalled();
  });
});
