import { __assign, __rest, __values } from "tslib";
import { getNextRefIdChar } from 'app/core/utils/query';
export function migrateMultipleStatsMetricsQuery(query, panelQueries) {
    var e_1, _a, e_2, _b;
    var newQueries = [];
    if ((query === null || query === void 0 ? void 0 : query.statistics) && (query === null || query === void 0 ? void 0 : query.statistics.length)) {
        query.statistic = query.statistics[0];
        try {
            for (var _c = __values(query.statistics.splice(1)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var stat = _d.value;
                newQueries.push(__assign(__assign({}, query), { statistic: stat }));
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    try {
        for (var newQueries_1 = __values(newQueries), newQueries_1_1 = newQueries_1.next(); !newQueries_1_1.done; newQueries_1_1 = newQueries_1.next()) {
            var newTarget = newQueries_1_1.value;
            newTarget.refId = getNextRefIdChar(panelQueries);
            delete newTarget.statistics;
            panelQueries.push(newTarget);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (newQueries_1_1 && !newQueries_1_1.done && (_b = newQueries_1.return)) _b.call(newQueries_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    delete query.statistics;
    return newQueries;
}
export function migrateMultipleStatsAnnotationQuery(annotationQuery) {
    var e_3, _a;
    var newAnnotations = [];
    if ((annotationQuery === null || annotationQuery === void 0 ? void 0 : annotationQuery.statistics) && (annotationQuery === null || annotationQuery === void 0 ? void 0 : annotationQuery.statistics.length)) {
        try {
            for (var _b = __values(annotationQuery.statistics.splice(1)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var stat = _c.value;
                var statistics = annotationQuery.statistics, name_1 = annotationQuery.name, newAnnotation = __rest(annotationQuery, ["statistics", "name"]);
                newAnnotations.push(__assign(__assign({}, newAnnotation), { statistic: stat, name: name_1 + " - " + stat }));
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        annotationQuery.statistic = annotationQuery.statistics[0];
        // Only change the name of the original if new annotations have been created
        if (newAnnotations.length !== 0) {
            annotationQuery.name = annotationQuery.name + " - " + annotationQuery.statistic;
        }
        delete annotationQuery.statistics;
    }
    return newAnnotations;
}
//# sourceMappingURL=migrations.js.map