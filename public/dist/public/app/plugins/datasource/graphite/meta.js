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
    var _a;
    for (const meta of metaList) {
        const archiveIndex = meta['archive-read'];
        if (archiveIndex > 0) {
            const schema = parseSchemaRetentions(meta['schema-retentions']);
            const intervalString = schema[archiveIndex].interval;
            const func = ((_a = meta['consolidator-normfetch']) !== null && _a !== void 0 ? _a : '').replace('Consolidator', '');
            return {
                text: `Data is rolled up, aggregated over ${intervalString} using ${func} function`,
                severity: 'info',
                inspect: 'meta',
            };
        }
    }
    return null;
}
export function getRuntimeConsolidationNotice(metaList) {
    var _a;
    for (const meta of metaList) {
        const runtimeNr = meta['aggnum-rc'];
        if (runtimeNr > 0) {
            const func = ((_a = meta['consolidator-rc']) !== null && _a !== void 0 ? _a : '').replace('Consolidator', '');
            return {
                text: `Data is runtime consolidated, ${runtimeNr} datapoints combined using ${func} function`,
                severity: 'info',
                inspect: 'meta',
            };
        }
    }
    return null;
}
export function parseSchemaRetentions(spec) {
    if (!spec) {
        return [];
    }
    return spec.split(',').map((str) => {
        const vals = str.split(':');
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