import { __awaiter } from "tslib";
import { CompletionItemKind } from '@grafana/experimental';
import { SqlDatasource } from 'app/features/plugins/sql/datasource/SqlDatasource';
import { formatSQL } from 'app/features/plugins/sql/utils/formatSQL';
import { mapFieldsToTypes } from './fields';
import { buildColumnQuery, buildTableQuery, showDatabases } from './mySqlMetaQuery';
import { getSqlCompletionProvider } from './sqlCompletionProvider';
import { quoteIdentifierIfNecessary, quoteLiteral, toRawSql } from './sqlUtil';
export class MySqlDatasource extends SqlDatasource {
    constructor(instanceSettings) {
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
    }
    getQueryModel() {
        return { quoteLiteral };
    }
    getSqlLanguageDefinition() {
        if (this.sqlLanguageDefinition !== undefined) {
            return this.sqlLanguageDefinition;
        }
        const args = {
            getMeta: (identifier) => this.fetchMeta(identifier),
        };
        this.sqlLanguageDefinition = {
            id: 'mysql',
            completionProvider: getSqlCompletionProvider(args),
            formatter: formatSQL,
        };
        return this.sqlLanguageDefinition;
    }
    fetchDatasets() {
        return __awaiter(this, void 0, void 0, function* () {
            const datasets = yield this.runSql(showDatabases(), { refId: 'datasets' });
            return datasets.map((t) => quoteIdentifierIfNecessary(t[0]));
        });
    }
    fetchTables(dataset) {
        return __awaiter(this, void 0, void 0, function* () {
            const tables = yield this.runSql(buildTableQuery(dataset), { refId: 'tables' });
            return tables.map((t) => quoteIdentifierIfNecessary(t[0]));
        });
    }
    fetchFields(query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query.dataset || !query.table) {
                return [];
            }
            const queryString = buildColumnQuery(query.table, query.dataset);
            const frame = yield this.runSql(queryString, { refId: 'fields' });
            const fields = frame.map((f) => ({
                name: f[0],
                text: f[0],
                value: quoteIdentifierIfNecessary(f[0]),
                type: f[1],
                label: f[0],
            }));
            return mapFieldsToTypes(fields);
        });
    }
    fetchMeta(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultDB = this.instanceSettings.jsonData.database;
            if (!(identifier === null || identifier === void 0 ? void 0 : identifier.schema) && defaultDB) {
                const tables = yield this.fetchTables(defaultDB);
                return tables.map((t) => ({ name: t, completion: `${defaultDB}.${t}`, kind: CompletionItemKind.Class }));
            }
            else if (!(identifier === null || identifier === void 0 ? void 0 : identifier.schema) && !defaultDB) {
                const datasets = yield this.fetchDatasets();
                return datasets.map((d) => ({ name: d, completion: `${d}.`, kind: CompletionItemKind.Module }));
            }
            else {
                if (!(identifier === null || identifier === void 0 ? void 0 : identifier.table) && (!defaultDB || (identifier === null || identifier === void 0 ? void 0 : identifier.schema))) {
                    const tables = yield this.fetchTables(identifier === null || identifier === void 0 ? void 0 : identifier.schema);
                    return tables.map((t) => ({ name: t, completion: t, kind: CompletionItemKind.Class }));
                }
                else if ((identifier === null || identifier === void 0 ? void 0 : identifier.table) && identifier.schema) {
                    const fields = yield this.fetchFields({ dataset: identifier.schema, table: identifier.table });
                    return fields.map((t) => ({ name: t.name, completion: t.value, kind: CompletionItemKind.Field }));
                }
                else {
                    return [];
                }
            }
        });
    }
    getDB() {
        if (this.db !== undefined) {
            return this.db;
        }
        return {
            datasets: () => this.fetchDatasets(),
            tables: (dataset) => this.fetchTables(dataset),
            fields: (query) => this.fetchFields(query),
            validateQuery: (query, _range) => Promise.resolve({ query, error: '', isError: false, isValid: true }),
            dsID: () => this.id,
            toRawSql,
            functions: () => ['VARIANCE', 'STDDEV'],
            getEditorLanguageDefinition: () => this.getSqlLanguageDefinition(),
        };
    }
}
//# sourceMappingURL=MySqlDatasource.js.map