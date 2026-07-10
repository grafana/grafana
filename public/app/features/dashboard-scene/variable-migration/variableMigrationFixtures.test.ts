import { config } from '@grafana/runtime';
import { type Dashboard, type DataSourceRef } from '@grafana/schema';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { detectMigratableVariables } from './detect';
import allValueWithOptions from './fixtures/allValueWithOptions.json';
import ambiguousKey from './fixtures/ambiguousKey.json';
import crossDatasource from './fixtures/crossDatasource.json';
import existingAdhoc from './fixtures/existingAdhoc.json';
import groupByPath from './fixtures/groupByPath.json';
import happyPath from './fixtures/happyPath.json';
import noCandidates from './fixtures/noCandidates.json';
import repeatDisqualifier from './fixtures/repeatDisqualifier.json';
import twoDatasources from './fixtures/twoDatasources.json';
import unsafePosition from './fixtures/unsafePosition.json';
import { applyVariableMigration } from './transform';

jest.mock('../saving/createDetectChangesWorker');

const instanceSettingsMap: Record<string, { uid: string; type: string; name: string; meta: object }> = {
  'prom-a': { uid: 'prom-a', type: 'prometheus', name: 'Prometheus A', meta: { multiValueFilterOperators: true } },
  'prom-b': { uid: 'prom-b', type: 'prometheus', name: 'Prometheus B', meta: { multiValueFilterOperators: true } },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: (ref: DataSourceRef | string | null | undefined) => {
      const uid = typeof ref === 'string' ? ref : ref?.uid;
      return uid === undefined ? instanceSettingsMap['prom-a'] : instanceSettingsMap[uid];
    },
  }),
}));

function loadScene(fixture: unknown) {
  return transformSaveModelToScene({
    dashboard: structuredClone(fixture) as DashboardDataDTO,
    meta: {},
  });
}

function getSerializedVariables(saveModel: Dashboard) {
  return saveModel.templating?.list ?? [];
}

function getSerializedExprs(saveModel: Dashboard): string[] {
  return (saveModel.panels ?? []).flatMap((panel) =>
    ('targets' in panel ? (panel.targets ?? []) : []).map((target) => String(target.expr))
  );
}

describe('variable migration fixture suite', () => {
  beforeAll(() => {
    config.featureToggles.dashboardUnifiedDrilldownControls = true;
  });

  it('1. happy path: structured and legacy label_values variables become one seeded adhoc variable', () => {
    const scene = loadScene(happyPath);

    const candidates = detectMigratableVariables(scene);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      variableName: 'instance',
      labelQueryKind: 'labelValues',
      kind: 'filter',
      filterKey: 'instance',
      disqualified: false,
    });
    expect(candidates[1]).toMatchObject({
      variableName: 'job',
      labelQueryKind: 'labelValues',
      kind: 'filter',
      filterKey: 'job',
      disqualified: false,
    });

    applyVariableMigration(scene, candidates);
    const saveModel = transformSceneToSaveModel(scene);

    const variables = getSerializedVariables(saveModel);
    expect(variables).toHaveLength(1);
    expect(variables[0]).toMatchObject({
      type: 'adhoc',
      name: 'filter0',
      datasource: { type: 'prometheus', uid: 'prom-a' },
      filters: [
        expect.objectContaining({ key: 'instance', operator: '=~', value: 'server-1' }),
        expect.objectContaining({ key: 'job', operator: '=', value: 'grafana' }),
      ],
    });

    expect(getSerializedExprs(saveModel)).toEqual(['sum(rate(up[5m]))', 'up']);
  });

  it('2. groupBy path: by($var) becomes enableGroupBy plus a groupBy filter entry', () => {
    const scene = loadScene(groupByPath);

    const candidates = detectMigratableVariables(scene);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      variableName: 'groupby',
      labelQueryKind: 'labelNames',
      kind: 'groupBy',
      disqualified: false,
    });

    applyVariableMigration(scene, candidates);
    const saveModel = transformSceneToSaveModel(scene);

    const variables = getSerializedVariables(saveModel);
    expect(variables).toHaveLength(1);
    expect(variables[0]).toMatchObject({
      type: 'adhoc',
      name: 'filter0',
      enableGroupBy: true,
      filters: [expect.objectContaining({ key: 'pod', operator: 'groupBy', value: '' })],
    });

    // per the S2 rule the empty by(...) modifier is dropped; promlib re-injects it
    expect(getSerializedExprs(saveModel)).toEqual(['sum (rate(up[5m]))']);
  });

  it('3. repeat disqualifier: repeated variable is returned disqualified and apply leaves everything untouched', () => {
    const scene = loadScene(repeatDisqualifier);

    const candidates = detectMigratableVariables(scene);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].disqualified).toBe(true);
    expect(candidates[0].reasons).toContainEqual(expect.objectContaining({ code: 'panel-repeat' }));

    // Disqualified candidates are never applied, even when passed in
    const result = applyVariableMigration(scene, candidates);
    expect(result.migratedVariableNames).toEqual([]);

    const saveModel = transformSceneToSaveModel(scene);
    expect(getSerializedVariables(saveModel)).toEqual([expect.objectContaining({ type: 'query', name: 'pod' })]);
    expect(saveModel.panels?.[0]).toMatchObject({ repeat: 'pod' });
    expect(getSerializedExprs(saveModel)).toEqual(['up{pod=~"$pod"}']);
  });

  it('4. cross-datasource disqualifier: variable on DS A interpolated into a DS B query', () => {
    const scene = loadScene(crossDatasource);

    const candidates = detectMigratableVariables(scene);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].disqualified).toBe(true);
    expect(candidates[0].reasons).toContainEqual(expect.objectContaining({ code: 'cross-datasource-usage' }));
  });

  it('5. unsafe position disqualifier: variable interpolated as metric name', () => {
    const scene = loadScene(unsafePosition);

    const candidates = detectMigratableVariables(scene);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].disqualified).toBe(true);
    expect(candidates[0].reasons).toContainEqual(expect.objectContaining({ code: 'unsafe-position' }));
  });

  it('6. two Prometheus datasources: one adhoc variable per datasource, each seeded with its own candidates', () => {
    const scene = loadScene(twoDatasources);

    const candidates = detectMigratableVariables(scene);
    expect(candidates.map((candidate) => candidate.disqualified)).toEqual([false, false]);

    applyVariableMigration(scene, candidates);
    const saveModel = transformSceneToSaveModel(scene);

    const variables = getSerializedVariables(saveModel);
    expect(variables).toHaveLength(2);
    expect(variables[0]).toMatchObject({
      type: 'adhoc',
      name: 'filter0',
      datasource: { uid: 'prom-a' },
      filters: [expect.objectContaining({ key: 'instance', operator: '=~', value: 'server-1' })],
    });
    expect(variables[1]).toMatchObject({
      type: 'adhoc',
      name: 'filter1',
      datasource: { uid: 'prom-b' },
      filters: [expect.objectContaining({ key: 'cluster', operator: '=~', value: 'cluster-1' })],
    });

    expect(getSerializedExprs(saveModel)).toEqual(['up', 'up']);
  });

  it('7. existing adhoc variable for the datasource is reused, no duplicate created', () => {
    const scene = loadScene(existingAdhoc);

    const candidates = detectMigratableVariables(scene);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].disqualified).toBe(false);

    applyVariableMigration(scene, candidates);
    const saveModel = transformSceneToSaveModel(scene);

    const variables = getSerializedVariables(saveModel);
    expect(variables).toHaveLength(1);
    expect(variables[0]).toMatchObject({
      type: 'adhoc',
      name: 'Filters',
      filters: [
        expect.objectContaining({ key: 'env', operator: '=', value: 'prod' }),
        expect.objectContaining({ key: 'instance', operator: '=~', value: 'server-1' }),
      ],
    });

    expect(getSerializedExprs(saveModel)).toEqual(['up']);
  });

  it('8. ambiguous label key: same variable under instance= and host= is disqualified', () => {
    const scene = loadScene(ambiguousKey);

    const candidates = detectMigratableVariables(scene);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].disqualified).toBe(true);
    expect(candidates[0].reasons).toContainEqual(
      expect.objectContaining({ code: 'ambiguous-filter-key', detail: 'host, instance' })
    );
    expect(candidates[0].filterKey).toBeUndefined();
  });

  it('9. no candidates: Prometheus queries but no label-type query variables', () => {
    const scene = loadScene(noCandidates);

    expect(detectMigratableVariables(scene)).toEqual([]);
  });

  it('10. dirty state: applying with the change tracker running marks isDirty without any save call', () => {
    const scene = loadScene(happyPath);
    scene.onEnterEditMode();
    expect(scene.state.isDirty).toBeFalsy();

    const candidates = detectMigratableVariables(scene);
    applyVariableMigration(scene, candidates);

    expect(scene.state.isDirty).toBe(true);
    // No save happened: only the runtime scene changed, the initial save model is intact
    expect(scene.getInitialSaveModel()).toMatchObject({ uid: 'fixture-happy-path' });
  });

  it('seeds no filter when the current value is All even with loaded options', () => {
    const scene = loadScene(allValueWithOptions);

    const candidates = detectMigratableVariables(scene);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ kind: 'filter', disqualified: false, currentValue: ['$__all'] });

    applyVariableMigration(scene, candidates);
    const saveModel = transformSceneToSaveModel(scene);

    const variables = getSerializedVariables(saveModel);
    expect(variables).toHaveLength(1);
    expect(variables[0]).toMatchObject({ type: 'adhoc', name: 'filter0', filters: [] });

    expect(getSerializedExprs(saveModel)).toEqual(['up']);
  });
});
