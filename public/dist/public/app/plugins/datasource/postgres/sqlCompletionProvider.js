import { __awaiter } from "tslib";
import { getStandardSQLCompletionProvider, } from '@grafana/experimental';
export const getSqlCompletionProvider = ({ getColumns, getTables }) => (monaco, language) => (Object.assign(Object.assign({}, (language && getStandardSQLCompletionProvider(monaco, language))), { tables: {
        resolve: () => __awaiter(void 0, void 0, void 0, function* () {
            return yield getTables.current();
        }),
    }, columns: {
        resolve: (t) => __awaiter(void 0, void 0, void 0, function* () {
            return yield getColumns.current({ table: t === null || t === void 0 ? void 0 : t.table, refId: 'A' });
        }),
    } }));
export function fetchColumns(db, q) {
    return __awaiter(this, void 0, void 0, function* () {
        const cols = yield db.fields(q);
        if (cols.length > 0) {
            return cols.map((c) => {
                return { name: c.value, type: c.value, description: c.value };
            });
        }
        else {
            return [];
        }
    });
}
export function fetchTables(db) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const tables = yield ((_a = db.lookup) === null || _a === void 0 ? void 0 : _a.call(db));
        return tables || [];
    });
}
//# sourceMappingURL=sqlCompletionProvider.js.map