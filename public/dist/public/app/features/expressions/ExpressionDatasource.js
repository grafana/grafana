import { __awaiter } from "tslib";
import { from, mergeMap } from 'rxjs';
import { PluginType, } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { ExpressionDatasourceUID, ExpressionQueryType } from './types';
/**
 * This is a singleton instance that just pretends to be a DataSource
 */
export class ExpressionDatasourceApi extends DataSourceWithBackend {
    constructor(instanceSettings) {
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
    }
    applyTemplateVariables(query, scopedVars) {
        const templateSrv = getTemplateSrv();
        return Object.assign(Object.assign({}, query), { expression: templateSrv.replace(query.expression, scopedVars), window: templateSrv.replace(query.window, scopedVars) });
    }
    getCollapsedText(query) {
        return `Expression: ${query.type}`;
    }
    query(request) {
        let targets = request.targets.map((query) => __awaiter(this, void 0, void 0, function* () {
            const ds = yield getDataSourceSrv().get(query.datasource);
            if (!ds.interpolateVariablesInQueries) {
                return query;
            }
            return ds === null || ds === void 0 ? void 0 : ds.interpolateVariablesInQueries([query], request.scopedVars, request.filters)[0];
        }));
        let sub = from(Promise.all(targets));
        return sub.pipe(mergeMap((t) => super.query(Object.assign(Object.assign({}, request), { targets: t }))));
    }
    newQuery(query) {
        var _a;
        return Object.assign({ refId: '--', datasource: ExpressionDatasourceRef, type: (_a = query === null || query === void 0 ? void 0 : query.type) !== null && _a !== void 0 ? _a : ExpressionQueryType.math }, query);
    }
}
export const instanceSettings = {
    id: -100,
    uid: ExpressionDatasourceUID,
    name: ExpressionDatasourceRef.name,
    type: ExpressionDatasourceRef.type,
    access: 'proxy',
    meta: {
        baseUrl: '',
        module: '',
        type: PluginType.datasource,
        name: ExpressionDatasourceRef.type,
        id: ExpressionDatasourceRef.type,
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
    readOnly: true,
};
export const dataSource = new ExpressionDatasourceApi(instanceSettings);
dataSource.meta = {
    id: ExpressionDatasourceRef.type,
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