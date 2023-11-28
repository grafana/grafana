// Functions in this file are called from the app/features/dashboard/state/DashboardMigrator.
// Migrations applied by the DashboardMigrator are performed before the plugin is loaded.
// DashboardMigrator migrations are tied to a certain minimum version of a dashboard which means they will only be ran once.
import { __rest } from "tslib";
import { getNextRefIdChar } from 'app/core/utils/query';
import { MetricQueryType, MetricEditorMode } from '../types';
// E.g query.statistics = ['Max', 'Min'] will be migrated to two queries - query1.statistic = 'Max' and query2.statistic = 'Min'
export function migrateMultipleStatsMetricsQuery(query, panelQueries) {
    const newQueries = [];
    if ((query === null || query === void 0 ? void 0 : query.statistics) && (query === null || query === void 0 ? void 0 : query.statistics.length)) {
        query.statistic = query.statistics[0];
        for (const stat of query.statistics.splice(1)) {
            newQueries.push(Object.assign(Object.assign({}, query), { statistic: stat }));
        }
    }
    for (const newTarget of newQueries) {
        newTarget.refId = getNextRefIdChar(panelQueries);
        delete newTarget.statistics;
        panelQueries.push(newTarget);
    }
    delete query.statistics;
    return newQueries;
}
// Migrates an annotation query that use more than one statistic into multiple queries
// E.g query.statistics = ['Max', 'Min'] will be migrated to two queries - query1.statistic = 'Max' and query2.statistic = 'Min'
export function migrateMultipleStatsAnnotationQuery(annotationQuery) {
    var _a;
    const newAnnotations = [];
    if (annotationQuery && 'statistics' in annotationQuery && ((_a = annotationQuery === null || annotationQuery === void 0 ? void 0 : annotationQuery.statistics) === null || _a === void 0 ? void 0 : _a.length)) {
        for (const stat of annotationQuery.statistics.splice(1)) {
            const { statistics, name } = annotationQuery, newAnnotation = __rest(annotationQuery, ["statistics", "name"]);
            newAnnotations.push(Object.assign(Object.assign({}, newAnnotation), { statistic: stat, name: `${name} - ${stat}` }));
        }
        annotationQuery.statistic = annotationQuery.statistics[0];
        // Only change the name of the original if new annotations have been created
        if (newAnnotations.length !== 0) {
            annotationQuery.name = `${annotationQuery.name} - ${annotationQuery.statistic}`;
        }
        delete annotationQuery.statistics;
    }
    return newAnnotations;
}
export function migrateCloudWatchQuery(query) {
    if (!query.hasOwnProperty('metricQueryType')) {
        query.metricQueryType = MetricQueryType.Search;
    }
    if (!query.hasOwnProperty('metricEditorMode')) {
        if (query.metricQueryType === MetricQueryType.Query) {
            query.metricEditorMode = MetricEditorMode.Code;
        }
        else {
            query.metricEditorMode = query.expression ? MetricEditorMode.Code : MetricEditorMode.Builder;
        }
    }
}
//# sourceMappingURL=dashboardMigrations.js.map