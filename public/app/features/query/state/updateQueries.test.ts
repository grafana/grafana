import { DataSourceApi, DataSourceWithQueryExportSupport, DataSourceWithQueryImportSupport } from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { updateQueries } from './updateQueries';

describe('updateQueries', () => {
  beforeEach(() => {
    setDataSourceSrv({
      get: (uid: string) => {
        if (uid === 'new-uid') {
          return Promise.resolve({
            uid,
            type: 'new-type',
            meta: {
              id: 'new-type',
            },
          } as DataSourceApi);
        }

        if (uid === 'new-uid-same-type') {
          return Promise.resolve({
            uid,
            type: 'old-type',
            meta: {
              id: 'old-type',
            },
          } as DataSourceApi);
        }

        if (uid === 'old-uid') {
          return Promise.resolve({
            uid,
            type: 'old-type',
            meta: {
              id: 'old-type',
            },
          } as DataSourceApi);
        }

        if (uid === 'mixed') {
          return Promise.resolve({
            uid,
            meta: {
              id: 'mixed',
              mixed: true,
            },
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
        uid: 'new-uid-same-type',
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

    expect(updated[0].datasource).toEqual({ type: 'same-type', uid: 'new-uid-same-type' });
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

  it('should change nothing mixed updated to mixed', async () => {
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
        uid: 'mixed',
        type: 'mixed',
        meta: {
          mixed: true,
        },
      } as any
    );

    expect(updated[0].datasource).toEqual({ type: 'old-type', uid: 'old-uid' });
    expect(updated[1].datasource).toEqual({ type: 'other-type', uid: 'other-uid' });
  });
});

describe('updateQueries with import', () => {
  it('should migrate abstract queries', async () => {
    const exportSpy = jest.fn();
    const importSpy = jest.fn();

    setDataSourceSrv({
      get: (uid: string) => {
        if (uid === 'new-uid') {
          return Promise.resolve({
            uid,
            type: 'new-type',
            meta: {
              id: 'new-type',
            },
            importFromAbstractQueries: (queries) => {
              importSpy(queries);
              const importedQueries = queries.map((q) => ({ ...q, imported: true }));
              return Promise.resolve(importedQueries);
            },
          } as DataSourceWithQueryImportSupport<any>);
        }

        if (uid === 'old-uid') {
          return Promise.resolve({
            uid,
            type: 'old-type',
            meta: {
              id: 'old-type',
            },
            exportToAbstractQueries: (queries) => {
              exportSpy(queries);
              const exportedQueries = queries.map((q) => ({ ...q, exported: true }));
              return Promise.resolve(exportedQueries);
            },
          } as DataSourceWithQueryExportSupport<any>);
        }

        return Promise.resolve({
          uid,
        } as DataSourceApi);
      },
    } as DataSourceSrv);

    const queries = [
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
    ];

    const updated = await updateQueries(
      {
        uid: 'new-uid',
        type: 'new-type',
      } as any,
      queries,
      {
        uid: 'old-uid',
        type: 'old-type',
      } as any
    );

    expect(exportSpy).toBeCalledWith(queries);
    expect(importSpy).toBeCalledWith(queries.map((q) => ({ ...q, exported: true })));

    expect(updated).toMatchInlineSnapshot(`
      Array [
        Object {
          "datasource": Object {
            "type": "new-type",
            "uid": "new-uid",
          },
          "exported": true,
          "imported": true,
          "refId": "A",
        },
        Object {
          "datasource": Object {
            "type": "new-type",
            "uid": "new-uid",
          },
          "exported": true,
          "imported": true,
          "refId": "B",
        },
      ]
    `);
  });

  it('should import queries when abstract queries are not supported by datasources', async () => {
    const importSpy = jest.fn();
    setDataSourceSrv({
      get: (uid: string) => {
        if (uid === 'new-uid') {
          return Promise.resolve({
            uid,
            type: 'new-type',
            meta: {
              id: 'new-type',
            },
            importQueries: (queries, origin) => {
              importSpy(queries, origin);
              const importedQueries = queries.map((q) => ({ ...q, imported: true }));
              return Promise.resolve(importedQueries);
            },
          } as DataSourceApi<any>);
        }

        if (uid === 'old-uid') {
          return Promise.resolve({
            uid,
            type: 'old-type',
            meta: {
              id: 'old-type',
            },
          } as DataSourceApi);
        }

        return Promise.resolve({
          uid,
        } as DataSourceApi);
      },
    } as DataSourceSrv);

    const queries = [
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
    ];

    const updated = await updateQueries(
      {
        uid: 'new-uid',
        type: 'new-type',
      } as any,
      queries,
      {
        uid: 'old-uid',
        type: 'old-type',
      } as any
    );

    expect(importSpy).toBeCalledWith(queries, { uid: 'old-uid', type: 'old-type', meta: { id: 'old-type' } });

    expect(updated).toMatchInlineSnapshot(`
      Array [
        Object {
          "datasource": Object {
            "type": "new-type",
            "uid": "new-uid",
          },
          "imported": true,
          "refId": "A",
        },
        Object {
          "datasource": Object {
            "type": "new-type",
            "uid": "new-uid",
          },
          "imported": true,
          "refId": "B",
        },
      ]
    `);
  });
});
