import {
  type AdHocVariableModel,
  type GroupByVariableModel,
  LoadingState,
  type TypedVariableModel,
} from '@grafana/data/types';
import { config } from '@grafana/runtime';
import type { AdhocVariableKind, GroupByVariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { migrateGroupByVariablesV1, migrateGroupByVariablesV2 } from './groupByMigration';

describe('groupByMigration', () => {
  beforeEach(() => {
    config.featureToggles.dashboardUnifiedDrilldownControls = true;
  });

  afterEach(() => {
    config.featureToggles.dashboardUnifiedDrilldownControls = false;
  });

  describe('migrateGroupByVariablesV1', () => {
    it('should return variables unchanged when FF is off', () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
      const vars = [makeAdhocV1(), makeGroupByV1()];
      expect(migrateGroupByVariablesV1(vars)).toBe(vars);
    });

    it('should return variables unchanged when there are no groupBy variables', () => {
      const vars: TypedVariableModel[] = [makeAdhocV1()];
      expect(migrateGroupByVariablesV1(vars)).toBe(vars);
    });

    it('should remove groupBy variable and enable groupBy on matching adhoc', () => {
      const adhoc = makeAdhocV1();
      const groupBy = makeGroupByV1({ current: {} });
      const result = migrateGroupByVariablesV1([adhoc, groupBy]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('adhoc');
      expect((result[0] as AdHocVariableModel).enableGroupBy).toBe(true);
    });

    it('should migrate current groupBy values as filters without origin', () => {
      const adhoc = makeAdhocV1();
      const groupBy = makeGroupByV1({
        current: { selected: true, text: ['CPU', 'Memory'], value: ['cpu', 'memory'] },
      });
      const result = migrateGroupByVariablesV1([adhoc, groupBy]);
      const migrated = result[0] as AdHocVariableModel;

      expect(migrated.filters).toEqual([
        { key: 'cpu', keyLabel: 'CPU', operator: 'groupBy', value: '', condition: '' },
        { key: 'memory', keyLabel: 'Memory', operator: 'groupBy', value: '', condition: '' },
      ]);
    });

    it('should migrate default groupBy values with origin dashboard', () => {
      const adhoc = makeAdhocV1();
      const groupBy = makeGroupByV1({
        current: {},
        defaultValue: { selected: true, text: ['Disk IO'], value: ['disk_io'] },
      });
      const result = migrateGroupByVariablesV1([adhoc, groupBy]);
      const migrated = result[0] as AdHocVariableModel;

      expect(migrated.filters).toEqual([
        { key: 'disk_io', keyLabel: 'Disk IO', operator: 'groupBy', value: '', condition: '', origin: 'dashboard' },
      ]);
    });

    it('should migrate both default and current values correctly', () => {
      const adhoc = makeAdhocV1();
      const groupBy = makeGroupByV1({
        current: { selected: true, text: ['CPU', 'Network'], value: ['cpu', 'network'] },
        defaultValue: { selected: true, text: ['CPU'], value: ['cpu'] },
      });
      const result = migrateGroupByVariablesV1([adhoc, groupBy]);
      const migrated = result[0] as AdHocVariableModel;

      expect(migrated.filters).toEqual([
        { key: 'cpu', keyLabel: 'CPU', operator: 'groupBy', value: '', condition: '', origin: 'dashboard' },
        { key: 'network', keyLabel: 'Network', operator: 'groupBy', value: '', condition: '' },
      ]);
    });

    it('should set keyLabel to key when labels are not provided', () => {
      const adhoc = makeAdhocV1();
      const groupBy = makeGroupByV1({
        current: { selected: true, text: 'cpu', value: 'cpu' },
      });
      const result = migrateGroupByVariablesV1([adhoc, groupBy]);
      const migrated = result[0] as AdHocVariableModel;

      expect(migrated.filters).toEqual([{ key: 'cpu', operator: 'groupBy', value: '', condition: '' }]);
    });

    it('should preserve existing adhoc filters and append groupBy filters', () => {
      const adhoc = makeAdhocV1({
        filters: [{ key: 'existing', operator: '=', value: 'test' }],
      });
      const groupBy = makeGroupByV1({
        current: { selected: true, text: 'cpu', value: 'cpu' },
      });
      const result = migrateGroupByVariablesV1([adhoc, groupBy]);
      const migrated = result[0] as AdHocVariableModel;

      expect(migrated.filters).toHaveLength(2);
      expect(migrated.filters[0]).toEqual({ key: 'existing', operator: '=', value: 'test' });
      expect(migrated.filters[1]).toEqual({
        key: 'cpu',
        operator: 'groupBy',
        value: '',
        condition: '',
      });
    });

    it('should handle single string current values', () => {
      const adhoc = makeAdhocV1();
      const groupBy = makeGroupByV1({
        current: { selected: true, text: 'CPU Usage', value: 'cpu_usage' },
      });
      const result = migrateGroupByVariablesV1([adhoc, groupBy]);
      const migrated = result[0] as AdHocVariableModel;

      expect(migrated.filters).toEqual([
        { key: 'cpu_usage', keyLabel: 'CPU Usage', operator: 'groupBy', value: '', condition: '' },
      ]);
    });

    it('should not merge groupBy into adhoc with different datasource', () => {
      const adhoc = makeAdhocV1({ datasource: { uid: 'other-ds', type: 'prometheus' } });
      const groupBy = makeGroupByV1({
        current: { selected: true, text: 'cpu', value: 'cpu' },
      });
      const result = migrateGroupByVariablesV1([adhoc, groupBy]);

      expect(result).toHaveLength(1);
      expect((result[0] as AdHocVariableModel).enableGroupBy).toBeUndefined();
      expect((result[0] as AdHocVariableModel).filters).toEqual([]);
    });
  });

  describe('migrateGroupByVariablesV2', () => {
    it('should return variables unchanged when FF is off', () => {
      config.featureToggles.dashboardUnifiedDrilldownControls = false;
      const vars = [makeAdhocV2(), makeGroupByV2()];
      expect(migrateGroupByVariablesV2(vars)).toBe(vars);
    });

    it('should remove groupBy variable and enable groupBy on matching adhoc', () => {
      const adhoc = makeAdhocV2();
      const groupBy = makeGroupByV2({ current: { text: '', value: '' } });
      const result = migrateGroupByVariablesV2([adhoc, groupBy]);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('AdhocVariable');
      expect((result[0] as AdhocVariableKind).spec.enableGroupBy).toBe(true);
    });

    it('should migrate current groupBy values as filters without origin', () => {
      const adhoc = makeAdhocV2();
      const groupBy = makeGroupByV2({
        current: { text: ['CPU', 'Memory'], value: ['cpu', 'memory'] },
      });
      const result = migrateGroupByVariablesV2([adhoc, groupBy]);
      const migrated = result[0] as AdhocVariableKind;

      expect(migrated.spec.filters).toEqual([
        { key: 'cpu', keyLabel: 'CPU', operator: 'groupBy', value: '', condition: '' },
        { key: 'memory', keyLabel: 'Memory', operator: 'groupBy', value: '', condition: '' },
      ]);
    });

    it('should migrate default groupBy values with origin dashboard', () => {
      const adhoc = makeAdhocV2();
      const groupBy = makeGroupByV2({
        current: { text: '', value: '' },
        defaultValue: { text: ['Disk IO'], value: ['disk_io'] },
      });
      const result = migrateGroupByVariablesV2([adhoc, groupBy]);
      const migrated = result[0] as AdhocVariableKind;

      expect(migrated.spec.filters).toEqual([
        { key: 'disk_io', keyLabel: 'Disk IO', operator: 'groupBy', value: '', condition: '', origin: 'dashboard' },
      ]);
    });

    it('should prioritize default values over current when key overlaps', () => {
      const adhoc = makeAdhocV2();
      const groupBy = makeGroupByV2({
        current: { text: ['CPU Label'], value: ['cpu'] },
        defaultValue: { text: ['CPU Default'], value: ['cpu'] },
      });
      const result = migrateGroupByVariablesV2([adhoc, groupBy]);
      const migrated = result[0] as AdhocVariableKind;

      expect(migrated.spec.filters).toEqual([
        { key: 'cpu', keyLabel: 'CPU Default', operator: 'groupBy', value: '', condition: '', origin: 'dashboard' },
      ]);
    });

    it('should migrate both default and current values correctly', () => {
      const adhoc = makeAdhocV2();
      const groupBy = makeGroupByV2({
        current: { text: ['CPU', 'Network'], value: ['cpu', 'network'] },
        defaultValue: { text: ['CPU'], value: ['cpu'] },
      });
      const result = migrateGroupByVariablesV2([adhoc, groupBy]);
      const migrated = result[0] as AdhocVariableKind;

      expect(migrated.spec.filters).toEqual([
        { key: 'cpu', keyLabel: 'CPU', operator: 'groupBy', value: '', condition: '', origin: 'dashboard' },
        { key: 'network', keyLabel: 'Network', operator: 'groupBy', value: '', condition: '' },
      ]);
    });
  });
});

function makeAdhocV1(overrides?: Partial<AdHocVariableModel>): AdHocVariableModel {
  return {
    id: 'adhoc',
    global: false,
    index: 0,
    state: LoadingState.NotStarted,
    error: null,
    name: 'adhoc',
    type: 'adhoc',
    datasource: { uid: 'prom-uid', type: 'prometheus' },
    filters: [],
    hide: 0,
    skipUrlSync: false,
    description: null,
    ...overrides,
  } as AdHocVariableModel;
}

function makeGroupByV1(overrides?: Partial<GroupByVariableModel>): GroupByVariableModel {
  return {
    id: 'groupby',
    global: false,
    index: 1,
    state: LoadingState.NotStarted,
    error: null,
    name: 'groupby',
    type: 'groupby',
    datasource: { uid: 'prom-uid', type: 'prometheus' },
    multi: true,
    current: {},
    options: [],
    query: '',
    hide: 0,
    skipUrlSync: false,
    description: null,
    ...overrides,
  } as GroupByVariableModel;
}

function makeAdhocV2(overrides?: Partial<AdhocVariableKind>): AdhocVariableKind {
  return {
    kind: 'AdhocVariable',
    group: '',
    datasource: { name: 'prom' },
    spec: {
      name: 'adhoc',
      baseFilters: [],
      filters: [],
      defaultKeys: [],
      hide: 'dontHide',
      skipUrlSync: false,
      allowCustomValue: true,
    },
    ...overrides,
  };
}

function makeGroupByV2(specOverrides?: Partial<GroupByVariableKind['spec']>): GroupByVariableKind {
  return {
    kind: 'GroupByVariable',
    group: '',
    datasource: { name: 'prom' },
    spec: {
      name: 'groupby',
      current: { text: '', value: '' },
      options: [],
      multi: true,
      hide: 'dontHide',
      skipUrlSync: false,
      ...specOverrides,
    },
  };
}
