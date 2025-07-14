import { first } from 'rxjs';

import {
  arrayToDataFrame,
  DataQueryResponse,
  DataSourceInstanceSettings,
  getDefaultTimeRange,
  LoadingState,
  standardTransformersRegistry,
  FieldType,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  SafeSerializableSceneObject,
  SceneDataNode,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  VizPanel,
} from '@grafana/scenes';
import { getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { MIXED_REQUEST_PREFIX } from '../mixed/MixedDataSource';

import { DashboardDatasource } from './datasource';
import { DashboardQuery } from './types';

jest.mock('rxjs', () => {
  const original = jest.requireActual('rxjs');
  return {
    ...original,
    first: jest.fn(original.first),
  };
});

standardTransformersRegistry.setInit(getStandardTransformers);
setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('DashboardDatasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should look up the other panel and subscribe to it's data", async () => {
    const { observable } = setup({ refId: 'A', panelId: 1 });

    let rsp: DataQueryResponse | undefined;

    observable.subscribe({ next: (data) => (rsp = data) });

    expect(rsp?.data[0].fields[0].values).toEqual([1, 2, 3]);
  });

  it('should always set response key', async () => {
    const { observable } = setup({ refId: 'A', panelId: 1 });

    let rsp: DataQueryResponse | undefined;

    observable.subscribe({ next: (data) => (rsp = data) });

    expect(rsp?.key).toEqual('source-ds-provider');
  });

  it('Can subscribe to panel data + transforms', async () => {
    jest.useFakeTimers();

    const { observable } = setup({ refId: 'A', panelId: 1, withTransforms: true });

    let rsp: DataQueryResponse | undefined;

    observable.subscribe({ next: (data) => (rsp = data) });

    jest.runAllTimers();

    expect(rsp?.data[0].fields[1].values).toEqual([3]);
  });

  it('Should activate source provder on observable subscribe and deactivate when completed (if only activator)', async () => {
    const { observable, sourceData } = setup({ refId: 'A', panelId: 1, withTransforms: true });

    const test = observable.subscribe({ next: () => {} });

    expect(sourceData.isActive).toBe(true);

    test.unsubscribe();

    expect(sourceData.isActive).toBe(false);
  });

  it('Should emit only the first value and complete if used within MixedDS', async () => {
    const { observable } = setup({ refId: 'A', panelId: 1 }, `${MIXED_REQUEST_PREFIX}1`);

    observable.subscribe({ next: () => {} });

    expect(first).toHaveBeenCalled();
  });

  it('Should not get the first emission if requestId does not contain the MixedDS prefix', async () => {
    const { observable } = setup({ refId: 'A', panelId: 1 });

    observable.subscribe({ next: () => {} });

    expect(first).not.toHaveBeenCalled();
  });

  it('Should not mutate field state in dataframe', () => {
    jest.useFakeTimers();
    const { observable } = setup({ refId: 'A', panelId: 1, withTransforms: true });

    let rsp: DataQueryResponse | undefined;

    const test = observable.subscribe({ next: (data) => (rsp = data) });

    jest.runAllTimers();

    // modifying series in dashboard DS should not affect the original dataframe
    rsp!.data[0].fields[0].state = {
      calcs: { sum: 3 },
    };

    test.unsubscribe();

    observable.subscribe({ next: (data) => (rsp = data) });

    jest.runAllTimers();

    // on further emissions the result should be the unmodified original dataframe
    expect(rsp!.data[0].fields[0].state).toEqual({});
  });

  describe('AdHoc Filtering', () => {
    const ds = new DashboardDatasource({} as DataSourceInstanceSettings);

    function createTestFrame(fields: any[]) {
      return {
        name: 'TestData',
        fields: fields.map((field) => ({
          name: field.name,
          type: field.type,
          values: field.values,
          config: {},
          state: {},
        })),
        length: fields[0]?.values.length || 0,
        refId: 'A',
      };
    }

    it('should apply equality filter correctly', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Bob'] },
        { name: 'age', type: FieldType.number, values: [25, 30, 35] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [{ key: 'name', operator: '=', value: 'John' }]);

      expect(result.fields[0].values).toEqual(['John']);
      expect(result.fields[1].values).toEqual([25]);
      expect(result.length).toBe(1);
    });

    it('should apply not-equal filter correctly', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Bob'] },
        { name: 'age', type: FieldType.number, values: [25, 30, 35] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [{ key: 'name', operator: '!=', value: 'John' }]);

      expect(result.fields[0].values).toEqual(['Jane', 'Bob']);
      expect(result.fields[1].values).toEqual([30, 35]);
      expect(result.length).toBe(2);
    });

    it('should apply multiple filters with AND logic', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Bob'] },
        { name: 'status', type: FieldType.string, values: ['active', 'active', 'inactive'] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [
        { key: 'name', operator: '!=', value: 'John' },
        { key: 'status', operator: '=', value: 'active' },
      ]);

      expect(result.fields[0].values).toEqual(['Jane']);
      expect(result.fields[1].values).toEqual(['active']);
      expect(result.length).toBe(1);
    });

    it('should handle null values correctly', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', null, 'Bob'] },
        { name: 'age', type: FieldType.number, values: [25, 30, 35] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [{ key: 'name', operator: '!=', value: 'John' }]);

      expect(result.fields[0].values).toEqual([null, 'Bob']);
      expect(result.fields[1].values).toEqual([30, 35]);
      expect(result.length).toBe(2);
    });

    it('should apply equality filter on numeric fields', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Bob'] },
        { name: 'age', type: FieldType.number, values: [25, 30, 35] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [{ key: 'age', operator: '=', value: '30' }]);

      expect(result.fields[0].values).toEqual(['Jane']);
      expect(result.fields[1].values).toEqual([30]);
      expect(result.length).toBe(1);
    });

    it('should apply not-equal filter on numeric fields', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Bob'] },
        { name: 'age', type: FieldType.number, values: [25, 30, 35] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [{ key: 'age', operator: '!=', value: '30' }]);

      expect(result.fields[0].values).toEqual(['John', 'Bob']);
      expect(result.fields[1].values).toEqual([25, 35]);
      expect(result.length).toBe(2);
    });

    it('should handle numeric fields with null values', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Bob'] },
        { name: 'age', type: FieldType.number, values: [25, null, 35] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [{ key: 'age', operator: '!=', value: '25' }]);

      expect(result.fields[0].values).toEqual(['Jane', 'Bob']);
      expect(result.fields[1].values).toEqual([null, 35]);
      expect(result.length).toBe(2);
    });

    it('should handle mixed string and numeric filtering', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Bob', 'Alice'] },
        { name: 'age', type: FieldType.number, values: [25, 30, 25, 35] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [
        { key: 'name', operator: '!=', value: 'Bob' },
        { key: 'age', operator: '=', value: '25' },
      ]);

      // Should match: name != 'Bob' AND age = 25
      // John: !Bob + 25 ✓
      // Jane: !Bob + 30 ✗
      // Bob: Bob + 25 ✗
      // Alice: !Bob + 35 ✗
      expect(result.fields[0].values).toEqual(['John']);
      expect(result.fields[1].values).toEqual([25]);
      expect(result.length).toBe(1);
    });

    it('should handle empty data frames', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: [] },
        { name: 'age', type: FieldType.number, values: [] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [{ key: 'name', operator: '=', value: 'John' }]);

      expect(result.fields[0].values).toEqual([]);
      expect(result.fields[1].values).toEqual([]);
      expect(result.length).toBe(0);
    });

    it.skip('should handle remaining operators', () => {
      // Not yet implemented, so we explicitly don't specify any behaviour for this
    });

    it.skip('should handle remaining field types (eg. date)', () => {
      // Not yet implemented, so we explicitly don't specify any behaviour for this
    });

    it('should handle filters on missing fields with = operator', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Bob'] },
        { name: 'age', type: FieldType.number, values: [25, 30, 35] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [{ key: 'missing_field', operator: '=', value: 'test' }]);

      // Should return empty result since field doesn't exist
      expect(result.fields[0].values).toEqual([]);
      expect(result.fields[1].values).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('should handle filters on missing fields with != operator', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Bob'] },
        { name: 'age', type: FieldType.number, values: [25, 30, 35] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [{ key: 'missing_field', operator: '!=', value: 'test' }]);

      // Should return all rows since field doesn't exist (all rows are "not equal")
      expect(result.fields[0].values).toEqual(['John', 'Jane', 'Bob']);
      expect(result.fields[1].values).toEqual([25, 30, 35]);
      expect(result.length).toBe(3);
    });

    it('should handle complex filtering scenario', () => {
      const frame = createTestFrame([
        { name: 'name', type: FieldType.string, values: ['John', 'Jane', 'Admin', 'Bob'] },
        { name: 'status', type: FieldType.string, values: ['active', 'inactive', 'active', 'active'] },
        { name: 'age', type: FieldType.number, values: [25, 30, 35, 40] },
      ]);

      const result = (ds as any).applyAdHocFilters(frame, [
        { key: 'status', operator: '=', value: 'active' },
        { key: 'name', operator: '!=', value: 'Admin' },
        { key: 'missing_field', operator: '!=', value: 'ignored' }, // Should be ignored
      ]);

      // Should match: status=active AND name!=Admin
      // John: active + !Admin ✓
      // Jane: inactive + !Admin ✗
      // Admin: active + Admin ✗
      // Bob: active + !Admin ✓
      expect(result.fields[0].values).toEqual(['John', 'Bob']);
      expect(result.fields[1].values).toEqual(['active', 'active']);
      expect(result.fields[2].values).toEqual([25, 40]);
      expect(result.length).toBe(2);
    });
  });
});

function setup(query: DashboardQuery, requestId?: string) {
  const sourceData = new SceneDataTransformer({
    $data: new SceneDataNode({
      data: {
        series: [arrayToDataFrame([1, 2, 3])],
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        structureRev: 11,
      },
    }),
    transformations: [{ id: 'reduce', options: {} }],
  });

  const scene = new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new VizPanel({
          key: getVizPanelKeyForPanelId(1),
          $data: sourceData,
        }),
      }),
    ],
  });

  const ds = new DashboardDatasource({} as DataSourceInstanceSettings);

  const observable = ds.query({
    timezone: 'utc',
    targets: [query],
    requestId: requestId ?? '',
    interval: '',
    intervalMs: 0,
    range: getDefaultTimeRange(),
    scopedVars: {
      __sceneObject: new SafeSerializableSceneObject(scene),
    },
    app: '',
    startTime: 0,
  });

  return { observable, sourceData };
}
