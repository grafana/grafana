import {
  DataQuery,
  DataSourceApi,
  DataSourceWithQueryExportSupport,
  DataSourceWithQueryImportSupport,
} from '@grafana/data';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { TestQuery } from 'app/core/utils/query.test';

import { updateQueries } from './updateQueries';

const oldUidDS = {
  uid: 'old-uid',
  type: 'old-type',
  meta: {
    id: 'old-type',
  },
} as DataSourceApi;

const mixedDS = {
  uid: 'mixed',
  meta: {
    id: 'mixed',
    mixed: true,
  },
} as DataSourceApi;

const newUidDS = {
  uid: 'new-uid',
  type: 'new-type',
  meta: {
    id: 'new-type',
  },
} as DataSourceApi;

const newUidSameTypeDS = {
  uid: 'new-uid-same-type',
  type: 'old-type',
  meta: {
    id: 'old-type',
  },
} as DataSourceApi;

describe('updateQueries', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('Should update all queries except expression query when changing data source with same type', async () => {
    const updated = await updateQueries(
      newUidSameTypeDS,
      'new-uid-same-type',
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
          datasource: ExpressionDatasourceRef,
        },
      ],
      oldUidDS
    );

    expect(updated[0].datasource).toEqual({ type: 'old-type', uid: 'new-uid-same-type' });
    expect(updated[1].datasource).toEqual(ExpressionDatasourceRef);
  });

  it('Should update all to uid string passed in even when different from real current ds uid', async () => {
    const updated = await updateQueries(
      newUidSameTypeDS,
      '${ds}',
      [
        {
          refId: 'A',
          datasource: {
            uid: 'old-uid',
            type: 'old-type',
          },
        },
      ],
      oldUidDS
    );

    expect(updated[0].datasource).toEqual({ type: 'old-type', uid: '${ds}' });
  });

  it('Should clear queries when changing type', async () => {
    const updated = await updateQueries(
      newUidDS,
      'new-uid',
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
      oldUidDS
    );

    expect(updated.length).toEqual(1);
    expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
  });

  it('Should clear queries and get default query from ds when changing type', async () => {
    newUidDS.getDefaultQuery = jest.fn().mockReturnValue({ test: 'default-query1' } as Partial<TestQuery>);
    const updated = await updateQueries(
      newUidDS,
      'new-uid',
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
      oldUidDS
    );

    expect(newUidDS.getDefaultQuery).toHaveBeenCalled();
    expect(updated as TestQuery[]).toEqual([
      {
        datasource: { type: 'new-type', uid: 'new-uid' },
        refId: 'A',
        test: 'default-query1',
      },
    ]);
  });

  it('Should return default query from ds when changing type and no new queries exist', async () => {
    newUidDS.getDefaultQuery = jest.fn().mockReturnValue({ test: 'default-query2' } as Partial<TestQuery>);
    const updated = await updateQueries(newUidDS, 'new-uid', [], oldUidDS);
    expect(newUidDS.getDefaultQuery).toHaveBeenCalled();
    expect(updated as TestQuery[]).toEqual([
      {
        datasource: { type: 'new-type', uid: 'new-uid' },
        refId: 'A',
        test: 'default-query2',
      },
    ]);
  });

  it('Should preserve query data source when changing to mixed', async () => {
    const updated = await updateQueries(
      mixedDS,
      'mixed',
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
      oldUidDS
    );

    expect(updated[0].datasource).toEqual({ type: 'old-type', uid: 'old-uid' });
    expect(updated[1].datasource).toEqual({ type: 'other-type', uid: 'other-uid' });
  });

  it('should change nothing mixed updated to mixed', async () => {
    const updated = await updateQueries(
      mixedDS,
      'mixed',
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
      mixedDS
    );

    expect(updated[0].datasource).toEqual({ type: 'old-type', uid: 'old-uid' });
    expect(updated[1].datasource).toEqual({ type: 'other-type', uid: 'other-uid' });
  });
});

describe('updateQueries with import', () => {
  describe('abstract queries support', () => {
    it('should migrate abstract queries', async () => {
      const exportSpy = jest.fn();
      const importSpy = jest.fn();

      const newUidDSWithAbstract = {
        uid: 'new-uid',
        type: 'new-type',
        meta: {
          id: 'new-type',
        },
        importFromAbstractQueries: (queries) => {
          importSpy(queries);
          const importedQueries = queries.map((q) => ({ ...q, imported: true }));
          return Promise.resolve(importedQueries);
        },
      } as DataSourceWithQueryImportSupport<any>;

      const oldUidDSWithAbstract = {
        uid: 'old-uid',
        type: 'old-type',
        meta: {
          id: 'old-type',
        },
        exportToAbstractQueries: (queries) => {
          exportSpy(queries);
          const exportedQueries = queries.map((q) => ({ ...q, exported: true }));
          return Promise.resolve(exportedQueries);
        },
      } as DataSourceWithQueryExportSupport<any>;

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
        newUidDSWithAbstract as any,
        (newUidDSWithAbstract as any).uid,
        queries,
        oldUidDSWithAbstract as any
      );

      expect(exportSpy).toBeCalledWith(queries);
      expect(importSpy).toBeCalledWith(queries.map((q) => ({ ...q, exported: true })));

      expect(updated).toMatchInlineSnapshot(`
        [
          {
            "datasource": {
              "type": "new-type",
              "uid": "new-uid",
            },
            "exported": true,
            "imported": true,
            "refId": "A",
          },
          {
            "datasource": {
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

    it('should clear queries when no queries were imported', async () => {
      const newUidDSWithAbstract = {
        uid: 'new-uid',
        type: 'new-type',
        meta: {
          id: 'new-type',
        },
        importFromAbstractQueries: () => {
          return Promise.resolve([]);
        },
      } as DataSourceWithQueryImportSupport<any>;

      const oldUidDSWithAbstract = {
        uid: 'old-uid',
        type: 'old-type',
        meta: {
          id: 'old-type',
        },
        exportToAbstractQueries: (queries) => {
          const exportedQueries = queries.map((q) => ({ ...q, exported: true }));
          return Promise.resolve(exportedQueries);
        },
      } as DataSourceWithQueryExportSupport<any>;

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
        newUidDSWithAbstract as any,
        (newUidDSWithAbstract as any).uid,
        queries,
        oldUidDSWithAbstract as any
      );

      expect(updated.length).toEqual(1);
      expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
    });
  });

  describe('importQueries support', () => {
    it('should import queries when abstract queries are not supported by datasources', async () => {
      const importSpy = jest.fn();

      const newUidDSWithImport = {
        uid: 'new-uid',
        type: 'new-type',
        meta: {
          id: 'new-type',
        },
        importQueries: (queries, origin) => {
          importSpy(queries, origin);
          const importedQueries = queries.map((q) => ({ ...q, imported: true }));
          return Promise.resolve(importedQueries);
        },
      } as DataSourceApi<any>;

      const oldUidDS = {
        uid: 'old-uid',
        type: 'old-type',
        meta: {
          id: 'old-type',
        },
      } as DataSourceApi;

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

      const updated = await updateQueries(newUidDSWithImport, newUidDSWithImport.uid, queries, oldUidDS);

      expect(importSpy).toBeCalledWith(queries, { uid: 'old-uid', type: 'old-type', meta: { id: 'old-type' } });

      expect(updated).toMatchInlineSnapshot(`
        [
          {
            "datasource": {
              "type": "new-type",
              "uid": "new-uid",
            },
            "imported": true,
            "refId": "A",
          },
          {
            "datasource": {
              "type": "new-type",
              "uid": "new-uid",
            },
            "imported": true,
            "refId": "B",
          },
        ]
      `);
    });

    it('should clear queries when no queries were imported', async () => {
      const newUidDSWithImport = {
        uid: 'new-uid',
        type: 'new-type',
        meta: {
          id: 'new-type',
        },
        importQueries: (queries, origin) => {
          return Promise.resolve([] as DataQuery[]);
        },
      } as DataSourceApi<any>;

      const oldUidDS = {
        uid: 'old-uid',
        type: 'old-type',
        meta: {
          id: 'old-type',
        },
      } as DataSourceApi;

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

      const updated = await updateQueries(newUidDSWithImport, 'new-uid', queries, oldUidDS);

      expect(updated.length).toEqual(1);
      expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
    });
  });
});
