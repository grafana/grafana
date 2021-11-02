import { __extends } from "tslib";
import { PluginType } from '@grafana/data';
import { ExpressionQueryType } from './types';
import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { DataSourceWithBackend } from '@grafana/runtime';
/**
 * This is a singleton instance that just pretends to be a DataSource
 */
var ExpressionDatasourceApi = /** @class */ (function (_super) {
    __extends(ExpressionDatasourceApi, _super);
    function ExpressionDatasourceApi(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.instanceSettings = instanceSettings;
        return _this;
    }
    ExpressionDatasourceApi.prototype.getCollapsedText = function (query) {
        return "Expression: " + query.type;
    };
    ExpressionDatasourceApi.prototype.newQuery = function (query) {
        var _a, _b;
        return {
            refId: '--',
            type: (_a = query === null || query === void 0 ? void 0 : query.type) !== null && _a !== void 0 ? _a : ExpressionQueryType.math,
            datasource: ExpressionDatasourceRef,
            conditions: (_b = query === null || query === void 0 ? void 0 : query.conditions) !== null && _b !== void 0 ? _b : undefined,
        };
    };
    return ExpressionDatasourceApi;
}(DataSourceWithBackend));
export { ExpressionDatasourceApi };
// MATCHES the constant in DataSourceWithBackend
export var ExpressionDatasourceID = '__expr__';
export var ExpressionDatasourceUID = '-100';
export var ExpressionDatasourceRef = Object.freeze({
    type: ExpressionDatasourceID,
    uid: ExpressionDatasourceID,
});
export var instanceSettings = {
    id: -100,
    uid: ExpressionDatasourceUID,
    name: ExpressionDatasourceID,
    type: 'grafana-expression',
    access: 'proxy',
    meta: {
        baseUrl: '',
        module: '',
        type: PluginType.datasource,
        name: ExpressionDatasourceID,
        id: ExpressionDatasourceID,
        info: {
            author: {
                name: 'Grafana Labs',
            },
            logos: {
                small: 'public/img/icn-datasource.svg',
                large: 'public/img/icn-datasource.svg',
            },
            description: 'Adds expression support to Grafana',
            screenshots: [],
            links: [],
            updated: '',
            version: '',
        },
    },
    jsonData: {},
};
export var dataSource = new ExpressionDatasourceApi(instanceSettings);
dataSource.meta = {
    id: ExpressionDatasourceID,
    info: {
        logos: {
            small: 'public/img/icn-datasource.svg',
            large: 'public/img/icn-datasource.svg',
        },
    },
};
dataSource.components = {
    QueryEditor: ExpressionQueryEditor,
};
//# sourceMappingURL=ExpressionDatasource.js.map