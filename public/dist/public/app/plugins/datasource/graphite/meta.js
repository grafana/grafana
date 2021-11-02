import { __values } from "tslib";
function toInteger(val) {
    if (val) {
        return parseInt(val, 10);
    }
    return undefined;
}
function toBooleanOrTimestamp(val) {
    if (val) {
        if (val === 'true') {
            return true;
        }
        if (val === 'false') {
            return false;
        }
        return parseInt(val, 10);
    }
    return undefined;
}
export function getRollupNotice(metaList) {
    var e_1, _a;
    var _b;
    try {
        for (var metaList_1 = __values(metaList), metaList_1_1 = metaList_1.next(); !metaList_1_1.done; metaList_1_1 = metaList_1.next()) {
            var meta = metaList_1_1.value;
            var archiveIndex = meta['archive-read'];
            if (archiveIndex > 0) {
                var schema = parseSchemaRetentions(meta['schema-retentions']);
                var intervalString = schema[archiveIndex].interval;
                var func = ((_b = meta['consolidator-normfetch']) !== null && _b !== void 0 ? _b : '').replace('Consolidator', '');
                return {
                    text: "Data is rolled up, aggregated over " + intervalString + " using " + func + " function",
                    severity: 'info',
                    inspect: 'meta',
                };
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (metaList_1_1 && !metaList_1_1.done && (_a = metaList_1.return)) _a.call(metaList_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return null;
}
export function getRuntimeConsolidationNotice(metaList) {
    var e_2, _a;
    var _b;
    try {
        for (var metaList_2 = __values(metaList), metaList_2_1 = metaList_2.next(); !metaList_2_1.done; metaList_2_1 = metaList_2.next()) {
            var meta = metaList_2_1.value;
            var runtimeNr = meta['aggnum-rc'];
            if (runtimeNr > 0) {
                var func = ((_b = meta['consolidator-rc']) !== null && _b !== void 0 ? _b : '').replace('Consolidator', '');
                return {
                    text: "Data is runtime consolidated, " + runtimeNr + " datapoints combined using " + func + " function",
                    severity: 'info',
                    inspect: 'meta',
                };
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (metaList_2_1 && !metaList_2_1.done && (_a = metaList_2.return)) _a.call(metaList_2);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return null;
}
export function parseSchemaRetentions(spec) {
    if (!spec) {
        return [];
    }
    return spec.split(',').map(function (str) {
        var vals = str.split(':');
        return {
            interval: vals[0],
            retention: vals[1],
            chunkspan: vals[2],
            numchunks: toInteger(vals[3]),
            ready: toBooleanOrTimestamp(vals[4]),
        };
    });
}
//# sourceMappingURL=meta.js.map