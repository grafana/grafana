import { __awaiter } from "tslib";
import { SqlDatasource } from 'app/features/plugins/sql/datasource/SqlDatasource';
import { formatSQL } from 'app/features/plugins/sql/utils/formatSQL';
import { PostgresQueryModel } from './PostgresQueryModel';
import { getSchema, getTimescaleDBVersion, getVersion, showTables } from './postgresMetaQuery';
import { fetchColumns, fetchTables, getSqlCompletionProvider } from './sqlCompletionProvider';
import { getFieldConfig, toRawSql } from './sqlUtil';
export class PostgresDatasource extends SqlDatasource {
    constructor(instanceSettings) {
        super(instanceSettings);
        this.sqlLanguageDefinition = undefined;
    }
    getQueryModel(target, templateSrv, scopedVars) {
        return new PostgresQueryModel(target, templateSrv, scopedVars);
    }
    getVersion() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const value = yield this.runSql(getVersion());
            const results = (_a = value.fields.version) === null || _a === void 0 ? void 0 : _a.values;
            if (!results) {
                return '';
            }
            return results[0].toString();
        });
    }
    getTimescaleDBVersion() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const value = yield this.runSql(getTimescaleDBVersion());
            const results = (_a = value.fields.extversion) === null || _a === void 0 ? void 0 : _a.values;
            if (!results) {
                return undefined;
            }
            return results[0];
        });
    }
    fetchTables() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const tables = yield this.runSql(showTables(), { refId: 'tables' });
            return (_b = (_a = tables.fields.table) === null || _a === void 0 ? void 0 : _a.values.flat()) !== null && _b !== void 0 ? _b : [];
        });
    }
    getSqlLanguageDefinition(db) {
        if (this.sqlLanguageDefinition !== undefined) {
            return this.sqlLanguageDefinition;
        }
        const args = {
            getColumns: { current: (query) => fetchColumns(db, query) },
            getTables: { current: () => fetchTables(db) },
        };
        this.sqlLanguageDefinition = {
            id: 'pgsql',
            completionProvider: getSqlCompletionProvider(args),
            formatter: formatSQL,
        };
        return this.sqlLanguageDefinition;
    }
    fetchFields(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const schema = yield this.runSql(getSchema(query.table), { refId: 'columns' });
            const result = [];
            for (let i = 0; i < schema.length; i++) {
                const column = schema.fields.column.values[i];
                const type = schema.fields.type.values[i];
                result.push(Object.assign({ label: column, value: column, type }, getFieldConfig(type)));
            }
            return result;
        });
    }
    getDB() {
        if (this.db !== undefined) {
            return this.db;
        }
        return {
            init: () => Promise.resolve(true),
            datasets: () => Promise.resolve([]),
            tables: () => this.fetchTables(),
            getEditorLanguageDefinition: () => this.getSqlLanguageDefinition(this.db),
            fields: (query) => __awaiter(this, void 0, void 0, function* () {
                if (!(query === null || query === void 0 ? void 0 : query.table)) {
                    return [];
                }
                return this.fetchFields(query);
            }),
            validateQuery: (query) => Promise.resolve({ isError: false, isValid: true, query, error: '', rawSql: query.rawSql }),
            dsID: () => this.id,
            toRawSql,
            lookup: () => __awaiter(this, void 0, void 0, function* () {
                const tables = yield this.fetchTables();
                return tables.map((t) => ({ name: t, completion: t }));
            }),
        };
    }
}
//# sourceMappingURL=datasource.js.map