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
  isV1ClassicDashboard,
  isV1DashboardCommand,
  isV2DashboardCommand,
} from './utils';

// Test data constants
const v1Spec: Dashboard = { title: 'Test', panels: [], schemaVersion: 1 };
const v2Spec = { elements: {}, layout: {} };
const v1Resource = { kind: 'DashboardWithAccessInfo', spec: v1Spec, metadata: { name: 'test' } };
const v2Resource = { kind: 'DashboardWithAccessInfo', spec: v2Spec, metadata: { name: 'test' } };

function createTestResource(
  spec: Dashboard | DashboardV2Spec | DashboardDataDTO,
  status?: Status
): Resource<Dashboard | DashboardV2Spec | DashboardDataDTO, Status> {
  return {
    apiVersion: 'v1',
    kind: 'Dashboard',
    metadata: { name: 'test', namespace: 'default', resourceVersion: '1', creationTimestamp: '2024-01-01T00:00:00Z' },
    spec,
    status,
  };
}

describe('spec type guards handle unknown inputs safely', () => {
  describe('isDashboardV2Spec', () => {
    it.each([
      ['v2 spec', v2Spec, true],
      ['v1 spec', v1Spec, false],
      ['null', null, false],
      ['undefined', undefined, false],
      ['string', 'string', false],
      ['number', 123, false],
      ['array', [], false],
    ])('%s returns %s', (_name, input, expected) => {
      expect(isDashboardV2Spec(input)).toBe(expected);
    });
  });

  describe('isDashboardV1Spec', () => {
    it.each([
      ['v1 spec', v1Spec, true],
      ['v2 spec', v2Spec, false],
      ['object without title', { panels: [] }, false],
      ['null', null, false],
    ])('%s returns %s', (_name, input, expected) => {
      expect(isDashboardV1Spec(input)).toBe(expected);
    });
  });

  it('isDashboardV0Spec distinguishes v0/v1 from v2', () => {
    expect(isDashboardV0Spec({ title: 'Test' } as DashboardDataDTO)).toBe(true);
    expect(isDashboardV0Spec({ elements: {} } as DashboardV2Spec)).toBe(false);
  });
});

describe('resource type guards handle unknown inputs safely', () => {
  describe('isDashboardResource', () => {
    it.each([
      ['valid k8s resource', v1Resource, true],
      ['valid k8s resource with kind Dashboard', { kind: 'Dashboard', spec: v1Spec }, true],
      ['missing spec', { kind: 'DashboardWithAccessInfo' }, false],
      ['plain dashboard', v1Spec, false],
      ['null', null, false],
      ['undefined', undefined, false],
    ])('%s returns %s', (_name, input, expected) => {
      expect(isDashboardResource(input)).toBe(expected);
    });
  });

  it.each([
    ['isDashboardV2Resource', isDashboardV2Resource, v2Resource, v1Resource],
    ['isDashboardV1Resource', isDashboardV1Resource, v1Resource, v2Resource],
  ])('%s correctly identifies resources', (_name, guard, matching, nonMatching) => {
    expect(guard(matching)).toBe(true);
    expect(guard(nonMatching)).toBe(false);
    expect(guard({ elements: {} })).toBe(false); // plain objects are not resources
  });
});

describe('command type guards', () => {
  it.each([
    ['v1 command', { dashboard: v1Spec as Dashboard }, true, false],
    ['v2 command', { dashboard: v2Spec as DashboardV2Spec }, false, true],
  ])('%s: isV1=%s, isV2=%s', (_name, cmd, isV1, isV2) => {
    expect(isV1DashboardCommand(cmd)).toBe(isV1);
    expect(isV2DashboardCommand(cmd)).toBe(isV2);
  });

  it('isV1ClassicDashboard distinguishes dashboard types', () => {
    expect(isV1ClassicDashboard(v1Spec)).toBe(true);
    expect(isV1ClassicDashboard(v2Spec as DashboardV2Spec)).toBe(false);
  });
});

describe('conversion status helpers', () => {
  it('getFailedVersion returns storedVersion only when failed', () => {
    const failed = createTestResource(v1Spec, { conversion: { failed: true, storedVersion: 'v1alpha1' } });
    const success = createTestResource(v1Spec, { conversion: { failed: false, storedVersion: 'v1alpha1' } });
    const noStatus = createTestResource(v1Spec);

    expect(getFailedVersion(failed)).toBe('v1alpha1');
    expect(getFailedVersion(success)).toBeUndefined();
    expect(getFailedVersion(noStatus)).toBeUndefined();
  });

  it.each([
    [['v1'], 'v1alpha1', true],
    [['v1', 'v2'], 'v2beta1', true],
    [['v1'], 'v2alpha1', false],
  ])('failedFromVersion with prefixes %s and version %s returns %s', (prefixes, version, expected) => {
    const item = createTestResource(v1Spec, { conversion: { failed: true, storedVersion: version } });
    expect(failedFromVersion(item, prefixes)).toBe(expected);
  });

  it('failedFromVersion returns false when conversion did not fail', () => {
    const item = createTestResource(v1Spec, { conversion: { failed: false, storedVersion: 'v1alpha1' } });
    expect(failedFromVersion(item, ['v1'])).toBe(false);
  });
});

describe('getDashboardsApiVersion', () => {
  beforeEach(() => {
    locationService.push('/test');
  });

  it.each([
    [{ dashboardScene: false, kubernetesDashboards: true }, undefined, 'v1'],
    [{ dashboardScene: false, kubernetesDashboards: false }, undefined, 'legacy'],
    [{ dashboardScene: true, kubernetesDashboards: true }, undefined, 'unified'],
    [{ dashboardScene: true, kubernetesDashboards: false }, undefined, 'legacy'],
    [{ dashboardScene: true, kubernetesDashboards: true }, 'v1', 'v1'],
    [{ dashboardScene: true, kubernetesDashboards: true, dashboardNewLayouts: true }, undefined, 'v2'],
  ])('with toggles %j and responseFormat %s returns %s', (toggles, responseFormat, expected) => {
    config.featureToggles = toggles;
    expect(getDashboardsApiVersion(responseFormat as 'v1' | 'v2' | undefined)).toBe(expected);
  });

  it('throws when requesting v2 without kubernetes dashboards', () => {
    config.featureToggles = { dashboardScene: true, kubernetesDashboards: false };
    expect(() => getDashboardsApiVersion('v2')).toThrow('v2 is not supported');
  });

  it('throws when requesting v2 with legacy architecture', () => {
    config.featureToggles = { dashboardScene: false, kubernetesDashboards: true };
    expect(() => getDashboardsApiVersion('v2')).toThrow('v2 is not supported for legacy');
  });

  describe('URL override scenes=false', () => {
    beforeAll(() => locationService.push('/test?scenes=false'));

    it.each([
      [{ dashboardScene: false, kubernetesDashboards: false }, 'legacy'],
      [{ dashboardScene: false, kubernetesDashboards: true }, 'v1'],
    ])('with toggles %j returns %s', (toggles, expected) => {
      config.featureToggles = toggles;
      expect(getDashboardsApiVersion()).toBe(expected);
    });
  });
});
