import { __awaiter } from "tslib";
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { updateQueries } from './updateQueries';
const oldUidDS = {
    uid: 'old-uid',
    type: 'old-type',
    meta: {
        id: 'old-type',
    },
};
const mixedDS = {
    uid: 'mixed',
    meta: {
        id: 'mixed',
        mixed: true,
    },
};
const newUidDS = {
    uid: 'new-uid',
    type: 'new-type',
    meta: {
        id: 'new-type',
    },
};
const newUidSameTypeDS = {
    uid: 'new-uid-same-type',
    type: 'old-type',
    meta: {
        id: 'old-type',
    },
};
const templateSrv = new TemplateSrv();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => templateSrv })));
describe('updateQueries', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('Should update all queries except expression query when changing data source with same type', () => __awaiter(void 0, void 0, void 0, function* () {
        const updated = yield updateQueries(newUidSameTypeDS, 'new-uid-same-type', [
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
        ], oldUidDS);
        expect(updated[0].datasource).toEqual({ type: 'old-type', uid: 'new-uid-same-type' });
        expect(updated[1].datasource).toEqual(ExpressionDatasourceRef);
    }));
    it('Should update all to uid string passed in even when different from real current ds uid', () => __awaiter(void 0, void 0, void 0, function* () {
        const updated = yield updateQueries(newUidSameTypeDS, '${ds}', [
            {
                refId: 'A',
                datasource: {
                    uid: 'old-uid',
                    type: 'old-type',
                },
            },
        ], oldUidDS);
        expect(updated[0].datasource).toEqual({ type: 'old-type', uid: '${ds}' });
    }));
    it('Should clear queries when changing type', () => __awaiter(void 0, void 0, void 0, function* () {
        const updated = yield updateQueries(newUidDS, 'new-uid', [
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
        ], oldUidDS);
        expect(updated.length).toEqual(1);
        expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
    }));
    it('Should clear queries and get default query from ds when changing type', () => __awaiter(void 0, void 0, void 0, function* () {
        newUidDS.getDefaultQuery = jest.fn().mockReturnValue({ test: 'default-query1' });
        const updated = yield updateQueries(newUidDS, 'new-uid', [
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
        ], oldUidDS);
        expect(newUidDS.getDefaultQuery).toHaveBeenCalled();
        expect(updated).toEqual([
            {
                datasource: { type: 'new-type', uid: 'new-uid' },
                refId: 'A',
                test: 'default-query1',
            },
        ]);
    }));
    it('Should return default query from ds when changing type and no new queries exist', () => __awaiter(void 0, void 0, void 0, function* () {
        newUidDS.getDefaultQuery = jest.fn().mockReturnValue({ test: 'default-query2' });
        const updated = yield updateQueries(newUidDS, 'new-uid', [], oldUidDS);
        expect(newUidDS.getDefaultQuery).toHaveBeenCalled();
        expect(updated).toEqual([
            {
                datasource: { type: 'new-type', uid: 'new-uid' },
                refId: 'A',
                test: 'default-query2',
            },
        ]);
    }));
    it('Should preserve query data source when changing to mixed', () => __awaiter(void 0, void 0, void 0, function* () {
        const updated = yield updateQueries(mixedDS, 'mixed', [
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
        ], oldUidDS);
        expect(updated[0].datasource).toEqual({ type: 'old-type', uid: 'old-uid' });
        expect(updated[1].datasource).toEqual({ type: 'other-type', uid: 'other-uid' });
    }));
    it('should change nothing mixed updated to mixed', () => __awaiter(void 0, void 0, void 0, function* () {
        const updated = yield updateQueries(mixedDS, 'mixed', [
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
        ], mixedDS);
        expect(updated[0].datasource).toEqual({ type: 'old-type', uid: 'old-uid' });
        expect(updated[1].datasource).toEqual({ type: 'other-type', uid: 'other-uid' });
    }));
    it('should preserve query when switching from mixed to a datasource where a query exists for the new datasource', () => __awaiter(void 0, void 0, void 0, function* () {
        const updated = yield updateQueries(newUidDS, 'new-uid', [
            {
                refId: 'A',
                datasource: {
                    uid: 'new-uid',
                    type: 'new-type',
                },
            },
            {
                refId: 'B',
                datasource: {
                    uid: 'other-uid',
                    type: 'other-type',
                },
            },
        ], mixedDS);
        expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
        expect(updated.length).toEqual(1);
    }));
    it('should preserve query when switching from mixed to a datasource where a query exists for the new datasource - when using datasource template variable', () => __awaiter(void 0, void 0, void 0, function* () {
        templateSrv.init([
            {
                current: {
                    text: 'Azure Monitor',
                    value: 'ds-uid',
                },
                name: 'ds',
                type: 'datasource',
                id: 'ds',
            },
        ]);
        const updated = yield updateQueries(newUidDS, '$ds', [
            {
                refId: 'A',
                datasource: {
                    uid: '$ds',
                    type: 'new-type',
                },
            },
            {
                refId: 'B',
                datasource: {
                    uid: 'other-uid',
                    type: 'other-type',
                },
            },
        ], mixedDS);
        expect(updated[0].datasource).toEqual({ type: 'new-type', uid: '$ds' });
        expect(updated.length).toEqual(1);
    }));
    it('will not preserve query when switch from mixed with a ds variable query to the same datasource (non-variable)', () => __awaiter(void 0, void 0, void 0, function* () {
        templateSrv.init([
            {
                current: {
                    text: 'Azure Monitor',
                    value: 'ds-uid',
                },
                name: 'ds',
                type: 'datasource',
                id: 'ds',
            },
        ]);
        const updated = yield updateQueries(newUidDS, 'new-uid', [
            {
                refId: 'A',
                datasource: {
                    uid: '$ds',
                    type: 'new-type',
                },
            },
            {
                refId: 'B',
                datasource: {
                    uid: 'other-uid',
                    type: 'other-type',
                },
            },
        ], mixedDS);
        expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
        expect(updated.length).toEqual(1);
    }));
    it('should update query refs when switching from mixed to a datasource where queries exist for new datasource', () => __awaiter(void 0, void 0, void 0, function* () {
        const updated = yield updateQueries(newUidDS, 'new-uid', [
            {
                refId: 'A',
                datasource: {
                    uid: 'new-uid',
                    type: 'new-type',
                },
            },
            {
                refId: 'B',
                datasource: {
                    uid: 'other-uid',
                    type: 'other-type',
                },
            },
            {
                refId: 'C',
                datasource: {
                    uid: 'new-uid',
                    type: 'new-type',
                },
            },
        ], mixedDS);
        expect(updated.length).toEqual(2);
        expect(updated[0].refId).toEqual('A');
        expect(updated[1].refId).toEqual('B');
    }));
});
describe('updateQueries with import', () => {
    describe('abstract queries support', () => {
        it('should migrate abstract queries', () => __awaiter(void 0, void 0, void 0, function* () {
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
                    const importedQueries = queries.map((q) => (Object.assign(Object.assign({}, q), { imported: true })));
                    return Promise.resolve(importedQueries);
                },
            };
            const oldUidDSWithAbstract = {
                uid: 'old-uid',
                type: 'old-type',
                meta: {
                    id: 'old-type',
                },
                exportToAbstractQueries: (queries) => {
                    exportSpy(queries);
                    const exportedQueries = queries.map((q) => (Object.assign(Object.assign({}, q), { exported: true })));
                    return Promise.resolve(exportedQueries);
                },
            };
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
            const updated = yield updateQueries(newUidDSWithAbstract, newUidDSWithAbstract.uid, queries, oldUidDSWithAbstract);
            expect(exportSpy).toBeCalledWith(queries);
            expect(importSpy).toBeCalledWith(queries.map((q) => (Object.assign(Object.assign({}, q), { exported: true }))));
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
        }));
        it('should clear queries when no queries were imported', () => __awaiter(void 0, void 0, void 0, function* () {
            const newUidDSWithAbstract = {
                uid: 'new-uid',
                type: 'new-type',
                meta: {
                    id: 'new-type',
                },
                importFromAbstractQueries: () => {
                    return Promise.resolve([]);
                },
            };
            const oldUidDSWithAbstract = {
                uid: 'old-uid',
                type: 'old-type',
                meta: {
                    id: 'old-type',
                },
                exportToAbstractQueries: (queries) => {
                    const exportedQueries = queries.map((q) => (Object.assign(Object.assign({}, q), { exported: true })));
                    return Promise.resolve(exportedQueries);
                },
            };
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
            const updated = yield updateQueries(newUidDSWithAbstract, newUidDSWithAbstract.uid, queries, oldUidDSWithAbstract);
            expect(updated.length).toEqual(1);
            expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
        }));
    });
    describe('importQueries support', () => {
        it('should import queries when abstract queries are not supported by datasources', () => __awaiter(void 0, void 0, void 0, function* () {
            const importSpy = jest.fn();
            const newUidDSWithImport = {
                uid: 'new-uid',
                type: 'new-type',
                meta: {
                    id: 'new-type',
                },
                importQueries: (queries, origin) => {
                    importSpy(queries, origin);
                    const importedQueries = queries.map((q) => (Object.assign(Object.assign({}, q), { imported: true })));
                    return Promise.resolve(importedQueries);
                },
            };
            const oldUidDS = {
                uid: 'old-uid',
                type: 'old-type',
                meta: {
                    id: 'old-type',
                },
            };
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
            const updated = yield updateQueries(newUidDSWithImport, newUidDSWithImport.uid, queries, oldUidDS);
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
        }));
        it('should clear queries when no queries were imported', () => __awaiter(void 0, void 0, void 0, function* () {
            const newUidDSWithImport = {
                uid: 'new-uid',
                type: 'new-type',
                meta: {
                    id: 'new-type',
                },
                importQueries: (queries, origin) => {
                    return Promise.resolve([]);
                },
            };
            const oldUidDS = {
                uid: 'old-uid',
                type: 'old-type',
                meta: {
                    id: 'old-type',
                },
            };
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
            const updated = yield updateQueries(newUidDSWithImport, 'new-uid', queries, oldUidDS);
            expect(updated.length).toEqual(1);
            expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
        }));
    });
});
//# sourceMappingURL=updateQueries.test.js.map