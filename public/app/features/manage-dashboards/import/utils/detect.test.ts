import { DashboardFormat } from 'app/features/dashboard/api/types';

import { detectDashboardFormat, extractDashboardSpec } from './detect';

describe('detectDashboardFormat', () => {
  it('detects v2 resource format', () => {
    const dashboard = { kind: 'DashboardWithAccessInfo', spec: { elements: {} } };
    expect(detectDashboardFormat(dashboard)).toBe(DashboardFormat.V2Resource);
  });

  it('detects v2 spec format (raw)', () => {
    const dashboard = { elements: {}, layout: {} };
    expect(detectDashboardFormat(dashboard)).toBe(DashboardFormat.V2Resource);
  });

  it('detects v1 resource format', () => {
    const dashboard = { kind: 'DashboardWithAccessInfo', spec: { title: 'v1' } };
    expect(detectDashboardFormat(dashboard)).toBe(DashboardFormat.V1Resource);
  });

  it('detects classic format', () => {
    const dashboard = { title: 'v1' };
    expect(detectDashboardFormat(dashboard)).toBe(DashboardFormat.Classic);
  });
});

describe('extractDashboardSpec', () => {
  it('extracts spec from v2 resource', () => {
    const v2Spec = { elements: {}, layout: {} };
    const resource = { kind: 'DashboardWithAccessInfo', spec: v2Spec };
    expect(extractDashboardSpec(resource)).toBe(v2Spec);
  });

  it('extracts spec from v1 resource', () => {
    const v1Spec = { title: 'Test Dashboard', panels: [] };
    const resource = { kind: 'DashboardWithAccessInfo', spec: v1Spec };
    expect(extractDashboardSpec(resource)).toBe(v1Spec);
  });

  it('returns raw v2 spec unchanged', () => {
    const v2Spec = { elements: {}, layout: {} };
    expect(extractDashboardSpec(v2Spec)).toBe(v2Spec);
  });

  it('returns classic dashboard unchanged', () => {
    const classic = { title: 'Test', panels: [] };
    expect(extractDashboardSpec(classic)).toBe(classic);
  });

  it('handles null', () => {
    expect(extractDashboardSpec(null)).toBe(null);
  });

  it('handles undefined', () => {
    expect(extractDashboardSpec(undefined)).toBe(undefined);
  });
});
