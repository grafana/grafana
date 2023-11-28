import { __awaiter } from "tslib";
import { getStandardSQLCompletionProvider, TokenType, } from '@grafana/experimental';
export const getSqlCompletionProvider = ({ getColumns, getTables }) => (monaco, language) => (Object.assign(Object.assign({}, (language && getStandardSQLCompletionProvider(monaco, language))), { tables: {
        resolve: (identifier) => __awaiter(void 0, void 0, void 0, function* () {
            return yield getTables.current(identifier === null || identifier === void 0 ? void 0 : identifier.table);
        }),
        parseName: (token) => {
            if (!token) {
                return { table: '' };
            }
            let processedToken = token;
            let tablePath = processedToken.value;
            while (processedToken.next && processedToken.next.type !== TokenType.Whitespace) {
                tablePath += processedToken.next.value;
                processedToken = processedToken.next;
            }
            if (processedToken.value.endsWith('.')) {
                tablePath = processedToken.value.slice(0, processedToken.value.length - 1);
            }
            return { table: tablePath };
        },
    }, columns: {
        resolve: (t) => __awaiter(void 0, void 0, void 0, function* () {
            if (!(t === null || t === void 0 ? void 0 : t.table)) {
                return [];
            }
            // TODO: Use schema instead of table
            const [database, schema, tableName] = t.table.split('.');
            return yield getColumns.current({ table: `${schema}.${tableName}`, dataset: database, refId: 'A' });
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
export function fetchTables(db, dataset) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const tables = yield ((_a = db.lookup) === null || _a === void 0 ? void 0 : _a.call(db, dataset));
        return tables || [];
    });
}
//# sourceMappingURL=sqlCompletionProvider.js.map