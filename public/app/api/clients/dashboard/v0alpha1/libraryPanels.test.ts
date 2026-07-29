import {
  k8sResourceToLegacyDTO,
  k8sResourceToLegacyModel,
  legacyModelToSpecAndStatus,
  type LibraryPanelResource,
} from './libraryPanels';

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
      id: 4,
      libraryPanel: { uid: 'x', name: 'name' },
      transformations: [{ id: 'reduce' }],
      maxDataPoints: 100,
    });

    expect(status.missing).toEqual({ transformations: [{ id: 'reduce' }], maxDataPoints: 100 });
    expect(spec.gridPos).toEqual({ x: 0, y: 0, w: 12, h: 8 });
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
});
