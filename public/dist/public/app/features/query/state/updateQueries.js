import { __awaiter } from "tslib";
import { CoreApp, hasQueryExportSupport, hasQueryImportSupport } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { getNextRefIdChar } from 'app/core/utils/query';
export function updateQueries(nextDS, nextDSUidOrVariableExpression, queries, currentDS) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let nextQueries = queries;
        const datasource = { type: nextDS.type, uid: nextDSUidOrVariableExpression };
        const DEFAULT_QUERY = Object.assign(Object.assign({}, (_a = nextDS === null || nextDS === void 0 ? void 0 : nextDS.getDefaultQuery) === null || _a === void 0 ? void 0 : _a.call(nextDS, CoreApp.PanelEditor)), { datasource, refId: 'A' });
        // we are changing data source type
        if ((currentDS === null || currentDS === void 0 ? void 0 : currentDS.meta.id) !== nextDS.meta.id) {
            // If changing to mixed do nothing
            if (nextDS.meta.mixed) {
                return queries;
            }
            // when both data sources support abstract queries
            else if (hasQueryExportSupport(currentDS) && hasQueryImportSupport(nextDS)) {
                const abstractQueries = yield currentDS.exportToAbstractQueries(queries);
                nextQueries = yield nextDS.importFromAbstractQueries(abstractQueries);
            }
            // when datasource supports query import
            else if (currentDS && nextDS.importQueries) {
                nextQueries = yield nextDS.importQueries(queries, currentDS);
            }
            // Otherwise clear queries that do not match the next datasource UID
            else {
                if (currentDS) {
                    const templateSrv = getTemplateSrv();
                    const reducedQueries = [];
                    let nextUid = nextDS.uid;
                    const nextIsTemplate = templateSrv.containsTemplate(nextDSUidOrVariableExpression);
                    if (nextIsTemplate) {
                        nextUid = templateSrv.replace(nextDS.uid);
                    }
                    // Queries will only be preserved if the datasource UID of the query matches the UID
                    // of the next chosen datasource
                    const nextDsQueries = queries.reduce((reduced, currentQuery) => {
                        if (currentQuery.datasource) {
                            let currUid = currentQuery.datasource.uid;
                            const currIsTemplate = templateSrv.containsTemplate(currUid);
                            if (currIsTemplate) {
                                currUid = templateSrv.replace(currentQuery.datasource.uid);
                            }
                            if (currUid === nextUid && currIsTemplate === nextIsTemplate) {
                                currentQuery.refId = getNextRefIdChar(reduced);
                                return reduced.concat([currentQuery]);
                            }
                        }
                        return reduced;
                    }, reducedQueries);
                    if (nextDsQueries.length > 0) {
                        return nextDsQueries;
                    }
                }
                return [DEFAULT_QUERY];
            }
        }
        if (nextQueries.length === 0) {
            return [DEFAULT_QUERY];
        }
        // Set data source on all queries except expression queries
        return nextQueries.map((query) => {
            if (!isExpressionReference(query.datasource) && !nextDS.meta.mixed) {
                query.datasource = datasource;
            }
            return query;
        });
    });
}
//# sourceMappingURL=updateQueries.js.map