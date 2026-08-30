import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';

import { transformTemplateToSaveModelSchemaV2 } from './dashboardTemplateEnvelope';

const buildSpec = (overrides: Partial<DashboardV2Spec> = {}): DashboardV2Spec =>
  ({
    title: 'Test',
    ...overrides,
  }) as DashboardV2Spec;

describe('transformTemplateToSaveModelSchemaV2', () => {
  it('returns a DashboardWithAccessInfo envelope', () => {
    const spec = buildSpec();
    const result = transformTemplateToSaveModelSchemaV2({ dashboardSpec: spec, dashboardVersion: 'v2beta1' });

    expect(result.kind).toBe('DashboardWithAccessInfo');
    expect(result.apiVersion).toBe('v2beta1');
    expect(result.metadata.name).toBe('');
    expect(result.metadata.creationTimestamp).toBe('');
  });

  it('returns a DashboardWithAccessInfo with dashboardAPIVersionResolver.getV2() when not provided', () => {
    const spec = buildSpec();
    const result = transformTemplateToSaveModelSchemaV2({ dashboardSpec: spec });

    expect(result.kind).toBe('DashboardWithAccessInfo');
    expect(result.apiVersion).toBe(dashboardAPIVersionResolver.getV2());
    expect(result.metadata.name).toBe('');
    expect(result.metadata.creationTimestamp).toBe('');
  });

  it("defaults metadata.resourceVersion to '0' when not provided", () => {
    const result = transformTemplateToSaveModelSchemaV2({ dashboardSpec: buildSpec(), dashboardVersion: 'v2' });
    expect(result.metadata.resourceVersion).toBe('0');
  });

  it('uses the provided resourceVersion when set', () => {
    const result = transformTemplateToSaveModelSchemaV2({
      dashboardSpec: buildSpec(),
      resourceVersion: '42',
      dashboardVersion: 'v2',
    });
    expect(result.metadata.resourceVersion).toBe('42');
  });

  it('passes the dashboard spec through unchanged', () => {
    const spec = buildSpec({ title: 'My Template' });
    const result = transformTemplateToSaveModelSchemaV2({ dashboardSpec: spec, dashboardVersion: 'v2' });
    expect(result.spec).toBe(spec);
  });

  it('hardcodes canStar / canShare / canDelete to false', () => {
    const result = transformTemplateToSaveModelSchemaV2({
      dashboardSpec: buildSpec(),
      canEdit: true,
      canSave: true,
      dashboardVersion: 'v2',
    });
    expect(result.access.canStar).toBe(false);
    expect(result.access.canShare).toBe(false);
    expect(result.access.canDelete).toBe(false);
  });

  it('defaults canSave / canEdit to false and honors overrides', () => {
    const defaults = transformTemplateToSaveModelSchemaV2({ dashboardSpec: buildSpec(), dashboardVersion: 'v2' });
    expect(defaults.access.canSave).toBe(false);
    expect(defaults.access.canEdit).toBe(false);

    const overridden = transformTemplateToSaveModelSchemaV2({
      dashboardSpec: buildSpec(),
      canSave: true,
      canEdit: true,
      dashboardVersion: 'v2',
    });
    expect(overridden.access.canSave).toBe(true);
    expect(overridden.access.canEdit).toBe(true);
  });
});
