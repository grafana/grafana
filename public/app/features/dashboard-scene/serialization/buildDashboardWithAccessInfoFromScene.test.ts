import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type AnnotationsPermissions } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';

import { buildDashboardWithAccessInfoFromScene } from './buildDashboardWithAccessInfoFromScene';

function buildFakeScene(overrides?: {
  k8sMetadata?: Record<string, unknown>;
  uid?: string;
  annotationsPermissions?: AnnotationsPermissions;
}): DashboardScene {
  const fakeScene = {
    serializer: { getK8SMetadata: () => overrides?.k8sMetadata },
    state: {
      uid: overrides?.uid,
      meta: {
        canEdit: true,
        canSave: true,
        canShare: false,
        canStar: true,
        canDelete: false,
        canAdmin: true,
        annotationsPermissions: overrides?.annotationsPermissions,
        slug: 'my-dashboard',
        url: '/d/dash-1/my-dashboard',
      },
    },
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal shape covering everything the builder reads
  return fakeScene as unknown as DashboardScene;
}

describe('buildDashboardWithAccessInfoFromScene', () => {
  const spec = {} as DashboardV2Spec;

  afterEach(() => {
    dashboardAPIVersionResolver.reset();
  });

  it('fully qualifies the apiVersion from the resolved v2 dashboard API version', () => {
    dashboardAPIVersionResolver.set({ v1: 'v1', v2: 'v2' });

    const result = buildDashboardWithAccessInfoFromScene(buildFakeScene(), spec);

    expect(result.apiVersion).toBe('dashboard.grafana.app/v2');
  });

  it('falls back to the beta v2 API version when discovery has not resolved', () => {
    dashboardAPIVersionResolver.reset();

    const result = buildDashboardWithAccessInfoFromScene(buildFakeScene(), spec);

    expect(result.apiVersion).toBe('dashboard.grafana.app/v2beta1');
  });

  it('preserves annotation permissions from the scene meta', () => {
    const annotationsPermissions: AnnotationsPermissions = {
      dashboard: { canAdd: true, canEdit: false, canDelete: true },
    };

    const result = buildDashboardWithAccessInfoFromScene(buildFakeScene({ annotationsPermissions }), spec);

    expect(result.access.annotationsPermissions).toBe(annotationsPermissions);
  });

  it('applies metadata defaults when no k8s metadata exists on the scene yet', () => {
    const result = buildDashboardWithAccessInfoFromScene(buildFakeScene({ uid: 'dash-1' }), spec);

    expect(result.metadata).toMatchObject({
      name: 'dash-1',
      generation: 1,
      resourceVersion: '0',
    });
    expect(typeof result.metadata.creationTimestamp).toBe('string');
    expect(Number.isNaN(Date.parse(result.metadata.creationTimestamp!))).toBe(false);
  });

  it('leaves the name empty when the scene has neither k8s metadata nor a uid', () => {
    const result = buildDashboardWithAccessInfoFromScene(buildFakeScene(), spec);

    expect(result.metadata.name).toBe('');
  });

  it('preserves existing k8s metadata fields instead of overwriting them with defaults', () => {
    const result = buildDashboardWithAccessInfoFromScene(
      buildFakeScene({
        k8sMetadata: {
          name: 'existing-name',
          generation: 7,
          creationTimestamp: '2020-01-01T00:00:00.000Z',
          resourceVersion: '42',
        },
        uid: 'dash-1',
      }),
      spec
    );

    expect(result.metadata).toMatchObject({
      name: 'existing-name',
      generation: 7,
      creationTimestamp: '2020-01-01T00:00:00.000Z',
      resourceVersion: '42',
    });
  });
});
