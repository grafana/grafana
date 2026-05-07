import { map } from 'rxjs';

import { toDataFrame } from '../dataframe/processDataFrame';
import { FieldType } from '../types/dataFrame';
import { type CustomTransformOperator, type DataTransformerInfo } from '../types/transformations';
import { mockTransformationsRegistry } from '../utils/tests/mockTransformationsRegistry';

import { ReducerID } from './fieldReducer';
import { FrameMatcherID } from './matchers/ids';
import { standardTransformersRegistry } from './standardTransformersRegistry';
import { __resetTransformationCacheForTests, transformDataFrame } from './transformDataFrame';
import { filterFieldsByNameTransformer } from './transformers/filterByName';
import { DataTransformerID } from './transformers/ids';
import { reduceTransformer, ReduceTransformerMode } from './transformers/reduce';

const getSeriesAWithSingleField = () =>
  toDataFrame({
    name: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
      { name: 'temperature', type: FieldType.number, values: [3, 4, 5, 6] },
    ],
  });

// Divide values by 100
const customTransform1: CustomTransformOperator = () => (source) => {
  return source.pipe(
    map((data) => {
      return data.map((frame) => {
        return {
          ...frame,
          fields: frame.fields.map((field) => {
            return {
              ...field,
              values: field.values.map((v) => v / 100),
            };
          }),
        };
      });
    })
  );
};

// Multiply values by 2
const customTransform2: CustomTransformOperator = () => (source) => {
  return source.pipe(
    map((data) => {
      return data.map((frame) => {
        return {
          ...frame,
          fields: frame.fields.map((field) => {
            return {
              ...field,
              values: field.values.map((v) => v * 2),
            };
          }),
        };
      });
    })
  );
};

describe('transformDataFrame', () => {
  beforeAll(() => {
    mockTransformationsRegistry([reduceTransformer, filterFieldsByNameTransformer]);
  });

  it('Applies all transforms', async () => {
    const cfg = [
      {
        id: DataTransformerID.reduce,
        options: {
          reducers: [ReducerID.first],
        },
      },
      {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            pattern: '/First/',
          },
        },
      },
    ];

    await expect(transformDataFrame(cfg, [getSeriesAWithSingleField()])).toEmitValuesWith((received) => {
      const processed = received[0];
      expect(processed[0].length).toEqual(1);
      expect(processed[0].fields.length).toEqual(1);
      expect(processed[0].fields[0].values[0]).toEqual(3);
    });
  });

  it('Skips over disabled transforms', async () => {
    const cfg = [
      {
        id: DataTransformerID.reduce,
        options: {
          reducers: [ReducerID.first],
        },
      },
      {
        id: DataTransformerID.filterFieldsByName,
        disabled: true,
        options: {
          include: {
            pattern: '/First/',
          },
        },
      },
    ];

    await expect(transformDataFrame(cfg, [getSeriesAWithSingleField()])).toEmitValuesWith((received) => {
      const processed = received[0];
      expect(processed[0].length).toEqual(1);
      expect(processed[0].fields.length).toEqual(2);
      expect(processed[0].fields[0].values[0]).toEqual('temperature');
    });
  });

  it('Support filtering', async () => {
    const frameA = toDataFrame({
      refId: 'A',
      fields: [{ name: 'value', type: FieldType.number, values: [5, 6] }],
    });
    const frameB = toDataFrame({
      refId: 'B',
      fields: [{ name: 'value', type: FieldType.number, values: [7, 8] }],
    });

    const cfg = [
      {
        id: DataTransformerID.reduce,
        filter: {
          id: FrameMatcherID.byRefId,
          options: 'A', // Only apply to A
        },
        options: {
          reducers: [ReducerID.first],
          mode: ReduceTransformerMode.ReduceFields,
        },
      },
    ];

    // Only apply A
    await expect(transformDataFrame(cfg, [frameA, frameB])).toEmitValuesWith((received) => {
      const processed = received[0].map((v) => v.fields[0].values);
      expect(processed).toBeTruthy();
      expect(processed).toMatchObject([[5], [7, 8]]);
    });

    // Only apply to B
    cfg[0].filter.options = 'B';
    await expect(transformDataFrame(cfg, [frameA, frameB])).toEmitValuesWith((received) => {
      const processed = received[0].map((v) => v.fields[0].values);
      expect(processed).toBeTruthy();
      expect(processed).toMatchObject([[5, 6], [7]]);
    });
  });

  describe('Custom transformations', () => {
    it('supports leading custom transformation', async () => {
      // divide by 100, reduce, filter
      const cfg = [
        customTransform1,
        {
          id: DataTransformerID.reduce,
          options: {
            reducers: [ReducerID.first],
          },
        },
        {
          id: DataTransformerID.filterFieldsByName,
          options: {
            include: {
              pattern: '/First/',
            },
          },
        },
      ];

      await expect(transformDataFrame(cfg, [getSeriesAWithSingleField()])).toEmitValuesWith((received) => {
        const processed = received[0];
        expect(processed[0].length).toEqual(1);
        expect(processed[0].fields.length).toEqual(1);
        expect(processed[0].fields[0].values[0]).toEqual(0.03);
      });
    });
    it('supports trailing custom transformation', async () => {
      // reduce, filter, divide by 100
      const cfg = [
        {
          id: DataTransformerID.reduce,
          options: {
            reducers: [ReducerID.first],
          },
        },
        {
          id: DataTransformerID.filterFieldsByName,
          options: {
            include: {
              pattern: '/First/',
            },
          },
        },
        customTransform1,
      ];

      await expect(transformDataFrame(cfg, [getSeriesAWithSingleField()])).toEmitValuesWith((received) => {
        const processed = received[0];
        expect(processed[0].length).toEqual(1);
        expect(processed[0].fields.length).toEqual(1);
        expect(processed[0].fields[0].values[0]).toEqual(0.03);
      });
    });

    it('supports mixed custom transformation', async () => {
      // reduce, multiply by 2, filter, divide by 100
      const cfg = [
        {
          id: DataTransformerID.reduce,
          options: {
            reducers: [ReducerID.first],
          },
        },
        customTransform2,
        {
          id: DataTransformerID.filterFieldsByName,
          options: {
            include: {
              pattern: '/First/',
            },
          },
        },
        customTransform1,
      ];

      await expect(transformDataFrame(cfg, [getSeriesAWithSingleField()])).toEmitValuesWith((received) => {
        const processed = received[0];
        expect(processed[0].length).toEqual(1);
        expect(processed[0].fields.length).toEqual(1);
        expect(processed[0].fields[0].values[0]).toEqual(0.06);
      });
    });
  });

  describe('transformation caching', () => {
    const CACHE_TEST_ID = '__transformDataFrame_cache_test__';
    const cfg = [{ id: CACHE_TEST_ID, options: { reducers: [ReducerID.first] } }];

    // The registry has no public unregister, and `register()` throws on duplicate
    // ids, so we register the test transformer once and swap the underlying
    // factory per test via this indirection.
    let transformationFactory: jest.Mock<Promise<DataTransformerInfo>, []> = jest.fn();

    beforeAll(() => {
      standardTransformersRegistry.register({
        id: CACHE_TEST_ID,
        transformation: () => transformationFactory(),
        name: 'Cache test',
        description: '',
        editor: () => null,
        imageDark: '',
        imageLight: '',
      });
    });

    beforeEach(() => {
      __resetTransformationCacheForTests();
      transformationFactory = jest.fn();
    });

    afterEach(() => {
      __resetTransformationCacheForTests();
    });

    it('calls the transformation factory only once for repeated pipeline runs', async () => {
      transformationFactory.mockResolvedValue(reduceTransformer);

      const data = [getSeriesAWithSingleField()];
      await expect(transformDataFrame(cfg, data)).toEmitValuesWith(() => {});
      await expect(transformDataFrame(cfg, data)).toEmitValuesWith(() => {});

      expect(transformationFactory).toHaveBeenCalledTimes(1);
    });

    it('only invokes the factory once when concurrent callers race before resolution', async () => {
      // Hold the factory promise unresolved until both subscriptions are in flight,
      // so we exercise the in-flight (not resolved) branch of the cache.
      let resolveFactory!: (info: DataTransformerInfo) => void;
      const factoryPromise = new Promise<DataTransformerInfo>((resolve) => {
        resolveFactory = resolve;
      });
      transformationFactory.mockReturnValue(factoryPromise);

      const data = [getSeriesAWithSingleField()];
      const first = transformDataFrame(cfg, data).toPromise();
      const second = transformDataFrame(cfg, data).toPromise();

      // Yield once so both subscriptions register their interest in the cached promise
      // before we resolve it; without the shared promise, each would call the factory.
      await Promise.resolve();
      resolveFactory(reduceTransformer);

      await Promise.all([first, second]);

      expect(transformationFactory).toHaveBeenCalledTimes(1);
    });

    it('evicts a rejected resolution so a subsequent call retries successfully', async () => {
      transformationFactory
        .mockRejectedValueOnce(new Error('transient load failure'))
        .mockResolvedValueOnce(reduceTransformer);

      const data = [getSeriesAWithSingleField()];

      await expect(transformDataFrame(cfg, data).toPromise()).rejects.toThrow('transient load failure');

      // Second call should hit the factory again (cache evicted) and succeed.
      await expect(transformDataFrame(cfg, data)).toEmitValuesWith(() => {});

      expect(transformationFactory).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scenes context', () => {
    let prevContext: unknown;

    beforeEach(() => {
      prevContext = window.__grafanaSceneContext;
      window.__grafanaSceneContext = {};
    });

    afterEach(() => {
      window.__grafanaSceneContext = prevContext;
    });

    it('calls ctx.interpolate for string options when not running in Scenes', async () => {
      delete window.__grafanaSceneContext;

      const interpolate = jest.fn((v: string) => v);
      const cfg = [{ id: DataTransformerID.reduce, options: { reducers: [ReducerID.first] } }];

      await expect(transformDataFrame(cfg, [getSeriesAWithSingleField()], { interpolate })).toEmitValuesWith(() => {});

      expect(interpolate).toHaveBeenCalled();
    });

    it('skips ctx.interpolate entirely when window.__grafanaSceneContext is set', async () => {
      const interpolate = jest.fn((v: string) => v);
      const cfg = [{ id: DataTransformerID.reduce, options: { reducers: [ReducerID.first] } }];

      await expect(transformDataFrame(cfg, [getSeriesAWithSingleField()], { interpolate })).toEmitValuesWith(() => {});

      expect(interpolate).not.toHaveBeenCalled();
    });
  });
});
