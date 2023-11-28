import { __awaiter } from "tslib";
import { SqlDatasource } from 'app/features/plugins/sql/datasource/SqlDatasource';
import { formatSQL } from 'app/features/plugins/sql/utils/formatSQL';
import { getSchema, showDatabases, getSchemaAndName } from './MSSqlMetaQuery';
import { MSSqlQueryModel } from './MSSqlQueryModel';
import { fetchColumns, fetchTables, getSqlCompletionProvider } from './sqlCompletionProvider';
import { getIcon, getRAQBType, toRawSql } from './sqlUtil';
export class MssqlDatasource extends SqlDatasource {
    constructor(instanceSettings) {
        super(instanceSettings);
        this.sqlLanguageDefinition = undefined;
    }
    getQueryModel(target, templateSrv, scopedVars) {
        return new MSSqlQueryModel(target, templateSrv, scopedVars);
    }
    fetchDatasets() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const datasets = yield this.runSql(showDatabases(), { refId: 'datasets' });
            return (_b = (_a = datasets.fields.name) === null || _a === void 0 ? void 0 : _a.values.flat()) !== null && _b !== void 0 ? _b : [];
        });
    }
    fetchTables(dataset) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            // We get back the table name with the schema as well. like dbo.table
            const tables = yield this.runSql(getSchemaAndName(dataset), { refId: 'tables' });
            return (_b = (_a = tables.fields.schemaAndName) === null || _a === void 0 ? void 0 : _a.values.flat()) !== null && _b !== void 0 ? _b : [];
        });
    }
    fetchFields(query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query.table) {
                return [];
            }
            const [_, table] = query.table.split('.');
            const schema = yield this.runSql(getSchema(query.dataset, table), {
                refId: 'columns',
            });
            const result = [];
            for (let i = 0; i < schema.length; i++) {
                const column = schema.fields.column.values[i];
                const type = schema.fields.type.values[i];
                result.push({ label: column, value: column, type, icon: getIcon(type), raqbFieldType: getRAQBType(type) });
            }
            return result;
        });
    }
    getSqlLanguageDefinition(db) {
        if (this.sqlLanguageDefinition !== undefined) {
            return this.sqlLanguageDefinition;
        }
        const args = {
            getColumns: { current: (query) => fetchColumns(db, query) },
            getTables: { current: (dataset) => fetchTables(db, dataset) },
        };
        this.sqlLanguageDefinition = {
            id: 'sql',
            completionProvider: getSqlCompletionProvider(args),
            formatter: formatSQL,
        };
        return this.sqlLanguageDefinition;
    }
    getDB() {
        if (this.db !== undefined) {
            return this.db;
        }
        return {
            init: () => Promise.resolve(true),
            datasets: () => this.fetchDatasets(),
            tables: (dataset) => this.fetchTables(dataset),
            getEditorLanguageDefinition: () => this.getSqlLanguageDefinition(this.db),
            fields: (query) => __awaiter(this, void 0, void 0, function* () {
                if (!(query === null || query === void 0 ? void 0 : query.dataset) || !(query === null || query === void 0 ? void 0 : query.table)) {
                    return [];
                }
                return this.fetchFields(query);
            }),
            validateQuery: (query) => Promise.resolve({ isError: false, isValid: true, query, error: '', rawSql: query.rawSql }),
            dsID: () => this.id,
            dispose: (_dsID) => { },
            toRawSql,
            lookup: (path) => __awaiter(this, void 0, void 0, function* () {
                if (!path) {
                    const datasets = yield this.fetchDatasets();
                    return datasets.map((d) => ({ name: d, completion: `${d}.` }));
                }
                else {
                    const parts = path.split('.').filter((s) => s);
                    if (parts.length > 2) {
                        return [];
                    }
                    if (parts.length === 1) {
                        const tables = yield this.fetchTables(parts[0]);
                        return tables.map((t) => ({ name: t, completion: t }));
                    }
                    else {
                        return [];
                    }
                }
            }),
        };
    }
}
//# sourceMappingURL=datasource.js.map