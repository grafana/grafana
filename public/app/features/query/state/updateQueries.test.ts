import {
  DataQuery,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePlugin,
  DataSourcePluginMeta,
} from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { updateQueries } from './updateQueries';

class TestDataSource {
  constructor(public instanceSettings: DataSourceInstanceSettings) {}
}

const datasourcePluginMock = new DataSourcePlugin(TestDataSource as any);
jest.mock('app/features/plugins/plugin_loader', () => ({
  importDataSourcePlugin: (meta: DataSourcePluginMeta) => {
    return Promise.resolve(datasourcePluginMock);
  },
}));

describe('updateQueries', () => {
  beforeEach(() => {
    setDataSourceSrv({
      get: (uid: string) => {
        if (uid === 'new-uid') {
          return Promise.resolve({
            uid,
            type: 'new-type',
          } as DataSourceApi);
        }

        return Promise.resolve({
          uid,
        } as DataSourceApi);
      },
    } as DataSourceSrv);
  });

  it('Should update all queries except expression query when changing data source with same type', async () => {
    const updated = await updateQueries(
      {
        uid: 'new-uid',
        type: 'same-type',
        meta: {},
      } as any,
      [
        {
          refId: 'A',
          datasource: {
            uid: 'old-uid',
            type: 'same-type',
          },
        },
        {
          refId: 'B',
          datasource: ExpressionDatasourceRef,
        },
      ],
      {
        uid: 'old-uid',
        type: 'same-type',
      } as any
    );

    expect(updated[0].datasource).toEqual({ type: 'same-type', uid: 'new-uid' });
    expect(updated[1].datasource).toEqual(ExpressionDatasourceRef);
  });

  it('Should clear queries when changing type', async () => {
    const updated = await updateQueries(
      {
        uid: 'new-uid',
        type: 'new-type',
        meta: {},
      } as any,
      [
        {
          refId: 'A',
          datasource: {
            uid: 'old-uid',
            type: 'old-type',
          },
        },
        {
          refId: 'B',
          datasource: {
            uid: 'old-uid',
            type: 'old-type',
          },
        },
      ],
      {
        uid: 'old-uid',
        type: 'old-type',
      } as any
    );

    expect(updated.length).toEqual(1);
    expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
  });

  it('Should preserve query data source when changing to mixed', async () => {
    const updated = await updateQueries(
      {
        uid: 'mixed',
        type: 'mixed',
        meta: {
          mixed: true,
        },
      } as any,
      [
        {
          refId: 'A',
          datasource: {
            uid: 'old-uid',
            type: 'old-type',
          },
        },
        {
          refId: 'B',
          datasource: {
            uid: 'other-uid',
            type: 'other-type',
          },
        },
      ],
      {
        uid: 'old-uid',
        type: 'old-type',
      } as any
    );

    expect(updated[0].datasource).toEqual({ type: 'old-type', uid: 'old-uid' });
    expect(updated[1].datasource).toEqual({ type: 'other-type', uid: 'other-uid' });
  });

  describe('migrating queries when changing data source', () => {
    beforeEach(() => {
      datasourcePluginMock.setDataSourceChangeHandler(
        (prev: DataSourceInstanceSettings, __: DataSourceInstanceSettings, qs: DataQuery[]) => {
          if (prev.uid === 'old-uid-skip') {
            return false;
          }
          return Promise.resolve(qs.map((q) => ({ ...q, addedProp: 'prop' }))) as any;
        }
      );
    });

    it('Should migrate queries when changing type and change handler defined', async () => {
      const updated = await updateQueries(
        {
          uid: 'new-uid',
          type: 'new-type',
          meta: {},
        } as any,
        [
          {
            refId: 'A',
            datasource: {
              uid: 'old-uid',
              type: 'old-type',
            },
          },
          {
            refId: 'B',
            datasource: {
              uid: 'old-uid',
              type: 'old-type',
            },
          },
        ],
        {
          uid: 'old-uid',
          type: 'old-type',
        } as any
      );

      expect(updated.length).toEqual(2);
      expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
      expect(updated[1].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
      expect(updated[0]).toHaveProperty('addedProp');
      expect(updated[1]).toHaveProperty('addedProp');
    });

    it('Should clear queries when handler returns false', async () => {
      const updated = await updateQueries(
        {
          uid: 'new-uid',
          type: 'new-type',
          meta: {},
        } as any,
        [
          {
            refId: 'A',
            datasource: {
              uid: 'old-uid-skip',
              type: 'old-type',
            },
          },
          {
            refId: 'B',
            datasource: {
              uid: 'old-uid-skip',
              type: 'old-type',
            },
          },
        ],
        {
          uid: 'old-uid-skip',
          type: 'old-type',
        } as any
      );

      expect(updated.length).toEqual(1);
      expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
      expect(updated[0]).not.toHaveProperty('addedProp');
    });
  });
});
