import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { detectDashboardChanges, isDashboardV2Spec } from './DetectChangesWorker';

function buildV1Dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    title: 'Test dashboard',
    schemaVersion: 39,
    ...overrides,
  } as Dashboard;
}

function buildV2Spec(overrides: Partial<DashboardV2Spec> = {}): DashboardV2Spec {
  return {
    title: 'Test dashboard',
    elements: {},
    ...overrides,
  } as DashboardV2Spec;
}

describe('detectDashboardChanges', () => {
  test('when initial and changed are identical, then hasChanges is false', () => {
    const initial = buildV1Dashboard();
    const changed = buildV1Dashboard();

    const result = detectDashboardChanges(changed, initial);

    expect(result.hasChanges).toBe(false);
    expect(result.diffCount).toBe(0);
    expect(result.diffs).toEqual({});
  });

  test('when changed has a modified property, then hasChanges is true', () => {
    const initial = buildV1Dashboard({ title: 'Original' });
    const changed = buildV1Dashboard({ title: 'Updated' });

    const result = detectDashboardChanges(changed, initial);

    expect(result.hasChanges).toBe(true);
    expect(result.diffCount).toBe(1);
    expect(result.diffs['title']).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'replace', value: 'Updated', originalValue: 'Original' })])
    );
  });

  test('when changed has an added property, then detects the addition', () => {
    const initial = buildV1Dashboard();
    const changed = buildV1Dashboard({ description: 'A new description' });

    const result = detectDashboardChanges(changed, initial);

    expect(result.hasChanges).toBe(true);
    expect(result.diffs['description']).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'add', value: 'A new description' })])
    );
  });

  test('when changed has a removed property, then detects the removal', () => {
    const initial = buildV1Dashboard({ description: 'Will be removed' });
    const changed = buildV1Dashboard();

    const result = detectDashboardChanges(changed, initial);

    expect(result.hasChanges).toBe(true);
    expect(result.diffs['description']).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'remove', originalValue: 'Will be removed' })])
    );
  });

  test('when changed has multiple differences, then diffCount reflects the total', () => {
    const initial = buildV1Dashboard({ title: 'Original', description: 'Old desc' });
    const changed = buildV1Dashboard({ title: 'Updated' });

    const result = detectDashboardChanges(changed, initial);

    expect(result.hasChanges).toBe(true);
    expect(result.diffCount).toBe(2);
  });

  test('when changed is a v2 spec and initial is a v1 Dashboard, then hasMigratedToV2 is true', () => {
    const initial = buildV1Dashboard();
    const changed = buildV2Spec({ title: 'Migrated' });

    const result = detectDashboardChanges(changed, initial);

    expect(result.hasMigratedToV2).toBe(true);
  });

  test('when both are v2 specs, then hasMigratedToV2 is false', () => {
    const initial = buildV2Spec();
    const changed = buildV2Spec({ title: 'Updated' });

    const result = detectDashboardChanges(changed, initial);

    expect(result.hasMigratedToV2).toBe(false);
  });

  test('when both are v1 Dashboards, then hasMigratedToV2 is false', () => {
    const initial = buildV1Dashboard();
    const changed = buildV1Dashboard({ title: 'Updated' });

    const result = detectDashboardChanges(changed, initial);

    expect(result.hasMigratedToV2).toBe(false);
  });

  test('when changed is a v1 Dashboard and initial is a v2 spec, then hasMigratedToV2 is false', () => {
    const initial = buildV2Spec();
    const changed = buildV1Dashboard({ title: 'Downgraded' });

    const result = detectDashboardChanges(changed, initial);

    expect(result.hasMigratedToV2).toBe(false);
  });

  test('returns changedSaveModel and initialSaveModel unchanged', () => {
    const initial = buildV1Dashboard({ title: 'Initial' });
    const changed = buildV1Dashboard({ title: 'Changed' });

    const result = detectDashboardChanges(changed, initial);

    expect(result.changedSaveModel).toBe(changed);
    expect(result.initialSaveModel).toBe(initial);
  });
});

describe('isDashboardV2Spec', () => {
  test('when object has elements property, then returns true', () => {
    const spec = buildV2Spec();

    expect(isDashboardV2Spec(spec)).toBe(true);
  });

  test('when object does not have elements property, then returns false', () => {
    const dashboard = buildV1Dashboard();

    expect(isDashboardV2Spec(dashboard)).toBe(false);
  });
});
