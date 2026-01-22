import { config, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { Spec as DashboardV2Spec, Status } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Resource } from 'app/features/apiserver/types';
import { DashboardDataDTO } from 'app/types/dashboard';

import {
  failedFromVersion,
  getDashboardsApiVersion,
  getFailedVersion,
  isDashboardResource,
  isDashboardV0Spec,
  isDashboardV1Resource,
  isDashboardV1Spec,
  isDashboardV2Resource,
  isDashboardV2Spec,
  isV0V1StoredVersion,
  isV1ClassicDashboard,
  isV1DashboardCommand,
  isV2DashboardCommand,
  isV2StoredVersion,
} from './utils';

function createResourceWithStatus(
  spec: Dashboard | DashboardV2Spec | DashboardDataDTO,
  status?: Status
): Resource<Dashboard | DashboardV2Spec | DashboardDataDTO, Status> {
  return {
    apiVersion: 'v1',
    kind: 'Dashboard',
    metadata: {
      name: 'test',
      namespace: 'default',
      resourceVersion: '1',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec,
    status,
  };
}

describe('isV2StoredVersion', () => {
  it('should return true for v2alpha1', () => {
    expect(isV2StoredVersion('v2alpha1')).toBe(true);
  });

  it('should return true for v2beta1', () => {
    expect(isV2StoredVersion('v2beta1')).toBe(true);
  });

  it('should return false for v1 versions', () => {
    expect(isV2StoredVersion('v1alpha1')).toBe(false);
    expect(isV2StoredVersion('v1beta1')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isV2StoredVersion(undefined)).toBe(false);
  });
});

describe('isV0V1StoredVersion', () => {
  it('should return true for v0alpha1', () => {
    expect(isV0V1StoredVersion('v0alpha1')).toBe(true);
  });

  it('should return true for v1alpha1', () => {
    expect(isV0V1StoredVersion('v1alpha1')).toBe(true);
  });

  it('should return true for v1beta1', () => {
    expect(isV0V1StoredVersion('v1beta1')).toBe(true);
  });

  it('should return false for v2 versions', () => {
    expect(isV0V1StoredVersion('v2alpha1')).toBe(false);
    expect(isV0V1StoredVersion('v2beta1')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isV0V1StoredVersion(undefined)).toBe(false);
  });
});

describe('isDashboardV2Spec', () => {
  it('should return true for v2 spec with elements', () => {
    const v2Spec = { elements: {}, layout: {} };
    expect(isDashboardV2Spec(v2Spec)).toBe(true);
  });

  it('should return false for v1 spec without elements', () => {
    const v1Spec = { title: 'Test Dashboard', panels: [] };
    expect(isDashboardV2Spec(v1Spec)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isDashboardV2Spec(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isDashboardV2Spec(undefined)).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isDashboardV2Spec('string')).toBe(false);
    expect(isDashboardV2Spec(123)).toBe(false);
    expect(isDashboardV2Spec([])).toBe(false);
  });
});

describe('isDashboardV1Spec', () => {
  it('should return true for v1 spec with title', () => {
    const v1Spec = { title: 'Test Dashboard', panels: [] };
    expect(isDashboardV1Spec(v1Spec)).toBe(true);
  });

  it('should return false for v2 spec', () => {
    const v2Spec = { title: 'Test', elements: {} };
    expect(isDashboardV1Spec(v2Spec)).toBe(false);
  });

  it('should return false for objects without title', () => {
    expect(isDashboardV1Spec({ panels: [] })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isDashboardV1Spec(null)).toBe(false);
  });
});

describe('isDashboardV0Spec', () => {
  it('should return true for v0/v1 spec', () => {
    const v1Spec = { title: 'Test Dashboard' } as DashboardDataDTO;
    expect(isDashboardV0Spec(v1Spec)).toBe(true);
  });

  it('should return false for v2 spec', () => {
    const v2Spec = { elements: {} } as DashboardV2Spec;
    expect(isDashboardV0Spec(v2Spec)).toBe(false);
  });
});

describe('isDashboardResource', () => {
  it('should return true for valid k8s resource', () => {
    const resource = {
      kind: 'DashboardWithAccessInfo',
      spec: { title: 'Test' },
      metadata: { name: 'test' },
    };
    expect(isDashboardResource(resource)).toBe(true);
  });

  it('should return false for non-k8s dashboard', () => {
    const dashboard = { title: 'Test', panels: [] };
    expect(isDashboardResource(dashboard)).toBe(false);
  });

  it('should return false for wrong kind', () => {
    const resource = {
      kind: 'Dashboard',
      spec: { title: 'Test' },
    };
    expect(isDashboardResource(resource)).toBe(false);
  });

  it('should return false for missing spec', () => {
    const resource = { kind: 'DashboardWithAccessInfo' };
    expect(isDashboardResource(resource)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isDashboardResource(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isDashboardResource(undefined)).toBe(false);
  });
});

describe('isDashboardV2Resource', () => {
  it('should return true for v2 k8s resource', () => {
    const resource = {
      kind: 'DashboardWithAccessInfo',
      spec: { elements: {}, layout: {} },
      metadata: { name: 'test' },
    };
    expect(isDashboardV2Resource(resource)).toBe(true);
  });

  it('should return false for v1 k8s resource', () => {
    const resource = {
      kind: 'DashboardWithAccessInfo',
      spec: { title: 'Test', panels: [] },
      metadata: { name: 'test' },
    };
    expect(isDashboardV2Resource(resource)).toBe(false);
  });

  it('should return false for non-k8s dashboard', () => {
    const dashboard = { elements: {} };
    expect(isDashboardV2Resource(dashboard)).toBe(false);
  });
});

describe('isDashboardV1Resource', () => {
  it('should return true for v1 k8s resource', () => {
    const resource = {
      kind: 'DashboardWithAccessInfo',
      spec: { title: 'Test', panels: [] },
      metadata: { name: 'test' },
    };
    expect(isDashboardV1Resource(resource)).toBe(true);
  });

  it('should return false for v2 k8s resource', () => {
    const resource = {
      kind: 'DashboardWithAccessInfo',
      spec: { elements: {} },
      metadata: { name: 'test' },
    };
    expect(isDashboardV1Resource(resource)).toBe(false);
  });

  it('should return false for non-k8s dashboard', () => {
    const dashboard = { title: 'Test' };
    expect(isDashboardV1Resource(dashboard)).toBe(false);
  });
});

describe('isV1DashboardCommand', () => {
  it('should return true for v1 dashboard command', () => {
    const cmd = { dashboard: { title: 'Test' } as Dashboard };
    expect(isV1DashboardCommand(cmd)).toBe(true);
  });

  it('should return false for v2 dashboard command', () => {
    const cmd = { dashboard: { elements: {} } as DashboardV2Spec };
    expect(isV1DashboardCommand(cmd)).toBe(false);
  });
});

describe('isV2DashboardCommand', () => {
  it('should return true for v2 dashboard command', () => {
    const cmd = { dashboard: { elements: {} } as DashboardV2Spec };
    expect(isV2DashboardCommand(cmd)).toBe(true);
  });

  it('should return false for v1 dashboard command', () => {
    const cmd = { dashboard: { title: 'Test' } as Dashboard };
    expect(isV2DashboardCommand(cmd)).toBe(false);
  });
});

describe('isV1ClassicDashboard', () => {
  it('should return true for v1 dashboard', () => {
    const dashboard = { title: 'Test' } as Dashboard;
    expect(isV1ClassicDashboard(dashboard)).toBe(true);
  });

  it('should return false for v2 dashboard', () => {
    const dashboard = { elements: {} } as DashboardV2Spec;
    expect(isV1ClassicDashboard(dashboard)).toBe(false);
  });
});

describe('getFailedVersion', () => {
  it('should return stored version when conversion failed', () => {
    const item = createResourceWithStatus({ title: 'Test' } as Dashboard, {
      conversion: { failed: true, storedVersion: 'v1alpha1' },
    });
    expect(getFailedVersion(item)).toBe('v1alpha1');
  });

  it('should return undefined when conversion did not fail', () => {
    const item = createResourceWithStatus({ title: 'Test' } as Dashboard, {
      conversion: { failed: false, storedVersion: 'v1alpha1' },
    });
    expect(getFailedVersion(item)).toBeUndefined();
  });

  it('should return undefined when no status', () => {
    const item = createResourceWithStatus({ title: 'Test' } as Dashboard);
    expect(getFailedVersion(item)).toBeUndefined();
  });
});

describe('failedFromVersion', () => {
  it('should return true when failed from matching version prefix', () => {
    const item = createResourceWithStatus({ title: 'Test' } as Dashboard, {
      conversion: { failed: true, storedVersion: 'v1alpha1' },
    });
    expect(failedFromVersion(item, ['v1'])).toBe(true);
  });

  it('should return true when matching any prefix', () => {
    const item = createResourceWithStatus({ title: 'Test' } as Dashboard, {
      conversion: { failed: true, storedVersion: 'v2beta1' },
    });
    expect(failedFromVersion(item, ['v1', 'v2'])).toBe(true);
  });

  it('should return false when no matching prefix', () => {
    const item = createResourceWithStatus({ title: 'Test' } as Dashboard, {
      conversion: { failed: true, storedVersion: 'v2alpha1' },
    });
    expect(failedFromVersion(item, ['v1'])).toBe(false);
  });

  it('should return false when conversion did not fail', () => {
    const item = createResourceWithStatus({ title: 'Test' } as Dashboard, {
      conversion: { failed: false, storedVersion: 'v1alpha1' },
    });
    expect(failedFromVersion(item, ['v1'])).toBe(false);
  });
});

describe('getDashboardsApiVersion', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should return v1 when dashboardScene is disabled and kubernetesDashboards is enabled', () => {
    config.featureToggles = {
      dashboardScene: false,
      kubernetesDashboards: true,
    };
    expect(getDashboardsApiVersion()).toBe('v1');
  });

  it('should return legacy when dashboardScene is disabled and kubernetesDashboards is disabled', () => {
    config.featureToggles = {
      dashboardScene: false,
      kubernetesDashboards: false,
    };
    expect(getDashboardsApiVersion()).toBe('legacy');
  });

  it('should return unified when dashboardScene is enabled and kubernetesDashboards is enabled', () => {
    config.featureToggles = {
      dashboardScene: true,
      kubernetesDashboards: true,
    };
    expect(getDashboardsApiVersion()).toBe('unified');
  });

  it('should return legacy when dashboardScene is enabled and kubernetesDashboards is disabled', () => {
    config.featureToggles = {
      dashboardScene: true,
      kubernetesDashboards: false,
    };
    expect(getDashboardsApiVersion()).toBe('legacy');
  });

  describe('forcing scenes through URL', () => {
    beforeAll(() => {
      locationService.push('/test?scenes=false');
    });

    it('should return legacy when kubernetesDashboards is disabled', () => {
      config.featureToggles = {
        dashboardScene: false,
        kubernetesDashboards: false,
      };
      expect(getDashboardsApiVersion()).toBe('legacy');
    });

    it('should return v1 when kubernetesDashboards is enabled', () => {
      config.featureToggles = {
        dashboardScene: false,
        kubernetesDashboards: true,
      };
      expect(getDashboardsApiVersion()).toBe('v1');
    });
  });
});
