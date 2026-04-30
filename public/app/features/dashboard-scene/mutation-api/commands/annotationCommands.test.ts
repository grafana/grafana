import { dataLayers, type SceneDataLayerProvider } from '@grafana/scenes';
import type { AnnotationQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import type { DashboardScene } from '../../scene/DashboardScene';
import { DashboardMutationClient } from '../DashboardMutationClient';
import type { MutationResult } from '../types';

const grafanaBuiltInLayer = (): DashboardAnnotationsDataLayer =>
  new DashboardAnnotationsDataLayer({
    name: 'Annotations & Alerts',
    isEnabled: true,
    isHidden: false,
    query: {
      builtIn: 1,
      datasource: { type: 'grafana', uid: '-- Grafana --' },
      enable: true,
      hide: true,
      iconColor: 'rgba(0, 211, 255, 1)',
      name: 'Annotations & Alerts',
      type: 'dashboard',
    },
  });

function buildMockScene(
  options: {
    editable?: boolean;
    isEditing?: boolean;
    annotationLayers?: SceneDataLayerProvider[];
    withDataLayerSet?: boolean;
  } = {}
): DashboardScene {
  const { editable = true, isEditing = false, annotationLayers = [], withDataLayerSet = true } = options;

  const dataLayerSet = withDataLayerSet ? new DashboardDataLayerSet({ annotationLayers }) : undefined;

  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing,
    $data: dataLayerSet,
  };
  const scene = {
    state,
    canEditDashboard: jest.fn(() => editable),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    forceRender: jest.fn(),
    publishEvent: undefined,
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock scene satisfies DashboardScene at runtime
  return scene as unknown as DashboardScene;
}

function makeAnnotationKind(name: string, overrides: Partial<AnnotationQueryKind['spec']> = {}): AnnotationQueryKind {
  return {
    kind: 'AnnotationQuery',
    spec: {
      name,
      enable: true,
      hide: false,
      iconColor: 'red',
      query: {
        kind: 'DataQuery',
        version: 'v0',
        group: 'prometheus',
        datasource: { name: 'prom-uid' },
        spec: { expr: 'changes(deploy_total[5m])' },
      },
      ...overrides,
    },
  };
}

describe('Annotation mutation commands', () => {
  let scene: ReturnType<typeof buildMockScene>;
  let client: DashboardMutationClient;

  beforeEach(() => {
    scene = buildMockScene({ editable: true });
    client = new DashboardMutationClient(scene);
  });

  describe('ADD_ANNOTATION', () => {
    it('adds an annotation layer', async () => {
      const result: MutationResult = await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('deploys') },
      });

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        path: '/annotations/deploys',
        previousValue: null,
        newValue: 'deploys',
      });

      const set = scene.state.$data as DashboardDataLayerSet;
      expect(set.state.annotationLayers).toHaveLength(1);
      expect(set.state.annotationLayers[0].state.name).toBe('deploys');
    });

    it('appends after existing layers when no position is given', async () => {
      scene = buildMockScene({
        editable: true,
        annotationLayers: [grafanaBuiltInLayer()],
      });
      client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('deploys') },
      });

      expect(result.success).toBe(true);
      const set = scene.state.$data as DashboardDataLayerSet;
      expect(set.state.annotationLayers.map((l) => l.state.name)).toEqual(['Annotations & Alerts', 'deploys']);
    });

    it('inserts at the specified position', async () => {
      scene = buildMockScene({
        editable: true,
        annotationLayers: [grafanaBuiltInLayer()],
      });
      client = new DashboardMutationClient(scene);

      // First, add another annotation at the end.
      await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('errors') },
      });

      // Then, insert "deploys" between built-in and errors.
      await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('deploys'), position: 1 },
      });

      const set = scene.state.$data as DashboardDataLayerSet;
      expect(set.state.annotationLayers.map((l) => l.state.name)).toEqual([
        'Annotations & Alerts',
        'deploys',
        'errors',
      ]);
    });

    it('rejects duplicate annotation name', async () => {
      await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('deploys') },
      });

      const result = await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('deploys') },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Annotation 'deploys' already exists");
    });

    it('rejects a second built-in annotation', async () => {
      scene = buildMockScene({
        editable: true,
        annotationLayers: [grafanaBuiltInLayer()],
      });
      client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_ANNOTATION',
        payload: {
          annotation: makeAnnotationKind('Another Built-in', { builtIn: true }),
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('built-in annotation');
    });
  });

  describe('UPDATE_ANNOTATION', () => {
    it('replaces an annotation layer in place', async () => {
      await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('deploys', { iconColor: 'red' }) },
      });
      await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('errors') },
      });

      const result = await client.execute({
        type: 'UPDATE_ANNOTATION',
        payload: {
          name: 'deploys',
          annotation: makeAnnotationKind('deploys', { iconColor: 'green' }),
        },
      });

      expect(result.success).toBe(true);
      const set = scene.state.$data as DashboardDataLayerSet;
      expect(set.state.annotationLayers.map((l) => l.state.name)).toEqual(['deploys', 'errors']);
      expect((set.state.annotationLayers[0] as DashboardAnnotationsDataLayer).state.query.iconColor).toBe('green');
    });

    it('returns error when annotation not found', async () => {
      const result = await client.execute({
        type: 'UPDATE_ANNOTATION',
        payload: {
          name: 'missing',
          annotation: makeAnnotationKind('missing'),
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Annotation 'missing' not found");
    });
  });

  describe('REMOVE_ANNOTATION', () => {
    it('removes an annotation by name', async () => {
      await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('deploys') },
      });

      const result = await client.execute({
        type: 'REMOVE_ANNOTATION',
        payload: { name: 'deploys' },
      });

      expect(result.success).toBe(true);
      const set = scene.state.$data as DashboardDataLayerSet;
      expect(set.state.annotationLayers).toHaveLength(0);
    });

    it('returns error for non-existent annotation', async () => {
      const result = await client.execute({
        type: 'REMOVE_ANNOTATION',
        payload: { name: 'missing' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Annotation 'missing' not found");
    });

    it('rejects removing the built-in annotation', async () => {
      scene = buildMockScene({
        editable: true,
        annotationLayers: [grafanaBuiltInLayer()],
      });
      client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'REMOVE_ANNOTATION',
        payload: { name: 'Annotations & Alerts' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('built-in');
    });
  });

  describe('LIST_ANNOTATIONS', () => {
    it('returns all annotation layers in scene order', async () => {
      scene = buildMockScene({
        editable: true,
        annotationLayers: [grafanaBuiltInLayer()],
      });
      client = new DashboardMutationClient(scene);

      await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('deploys') },
      });

      const result = await client.execute({ type: 'LIST_ANNOTATIONS', payload: {} });

      expect(result.success).toBe(true);
      const data = result.data as { annotations: AnnotationQueryKind[] };
      expect(data.annotations.map((a) => a.spec.name)).toEqual(['Annotations & Alerts', 'deploys']);
    });

    it('returns an empty list when the dashboard has no data layer set', async () => {
      scene = buildMockScene({ editable: true, withDataLayerSet: false });
      client = new DashboardMutationClient(scene);

      const result = await client.execute({ type: 'LIST_ANNOTATIONS', payload: {} });

      expect(result.success).toBe(true);
      expect((result.data as { annotations: unknown[] }).annotations).toEqual([]);
    });

    it('skips non-annotation layers', async () => {
      scene = buildMockScene({
        editable: true,
        annotationLayers: [grafanaBuiltInLayer()],
      });
      client = new DashboardMutationClient(scene);

      // Inject a non-annotation provider to confirm filtering.
      const set = scene.state.$data as DashboardDataLayerSet;
      const fakeLayer = {
        state: { name: 'fake-layer' },
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structural mock for filtering test
      } as unknown as SceneDataLayerProvider;
      set.setState({ annotationLayers: [...set.state.annotationLayers, fakeLayer] });

      const result = await client.execute({ type: 'LIST_ANNOTATIONS', payload: {} });
      const data = result.data as { annotations: AnnotationQueryKind[] };
      expect(data.annotations.map((a) => a.spec.name)).toEqual(['Annotations & Alerts']);
      expect(dataLayers.AnnotationsDataLayer).toBeDefined();
    });
  });

  describe('Permissions and validation', () => {
    it('rejects writes when dashboard is not editable', async () => {
      scene = buildMockScene({ editable: false });
      client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_ANNOTATION',
        payload: { annotation: makeAnnotationKind('deploys') },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot edit dashboard');
    });

    it('rejects ADD_ANNOTATION with missing required spec.name', async () => {
      const result = await client.execute({
        type: 'ADD_ANNOTATION',
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- intentionally invalid for validation test
        payload: { annotation: { kind: 'AnnotationQuery', spec: {} } } as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });
});
