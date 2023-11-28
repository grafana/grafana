import { __awaiter } from "tslib";
import { each, flatten, groupBy, isArray } from 'lodash';
import { FieldType } from '@grafana/data';
import { toDataQueryResponse } from '@grafana/runtime';
import TableModel from 'app/core/TableModel';
export default class ResponseParser {
    parse(query, results) {
        if (!(results === null || results === void 0 ? void 0 : results.results) || results.results.length === 0) {
            return [];
        }
        const influxResults = results.results[0];
        if (!influxResults.series) {
            return [];
        }
        const normalizedQuery = query.toLowerCase();
        const isRetentionPolicyQuery = normalizedQuery.indexOf('show retention policies') >= 0;
        const isValueFirst = normalizedQuery.indexOf('show field keys') >= 0 || isRetentionPolicyQuery;
        const res = new Set();
        each(influxResults.series, (serie) => {
            each(serie.values, (value) => {
                if (isArray(value)) {
                    // In general, there are 2 possible shapes for the returned value.
                    // The first one is a two-element array,
                    // where the first element is somewhat a metadata value:
                    // the tag name for SHOW TAG VALUES queries,
                    // the time field for SELECT queries, etc.
                    // The second shape is an one-element array,
                    // that is containing an immediate value.
                    // For example, SHOW FIELD KEYS queries return such shape.
                    // Note, pre-0.11 versions return
                    // the second shape for SHOW TAG VALUES queries
                    // (while the newer versions—first).
                    if (isValueFirst) {
                        res.add(value[0].toString());
                    }
                    else if (value[1] !== undefined) {
                        res.add(value[1].toString());
                    }
                    else {
                        res.add(value[0].toString());
                    }
                }
                else {
                    res.add(value.toString());
                }
            });
        });
        // NOTE: it is important to keep the order of items in the parsed output
        // the same as it was in the influxdb-response.
        // we use a `Set` to collect the unique-results, and `Set` iteration
        // order is insertion-order, so this should be ok.
        return Array.from(res).map((v) => ({ text: v }));
    }
    getTable(dfs, target, meta) {
        var _a;
        let table = new TableModel();
        if (dfs.length > 0) {
            table.meta = Object.assign(Object.assign({}, meta), { executedQueryString: (_a = dfs[0].meta) === null || _a === void 0 ? void 0 : _a.executedQueryString });
            table.refId = target.refId;
            table = getTableCols(dfs, table, target);
            // if group by tag(s) added
            if (dfs[0].fields[1] && dfs[0].fields[1].labels) {
                let dfsByLabels = groupBy(dfs, (df) => df.fields[1].labels ? Object.values(df.fields[1].labels) : null);
                const labels = Object.keys(dfsByLabels);
                const dfsByLabelValues = Object.values(dfsByLabels);
                for (let i = 0; i < dfsByLabelValues.length; i++) {
                    table = getTableRows(dfsByLabelValues[i], table, [...labels[i].split(',')]);
                }
            }
            else {
                table = getTableRows(dfs, table, []);
            }
        }
        return table;
    }
    transformAnnotationResponse(annotation, data, target) {
        return __awaiter(this, void 0, void 0, function* () {
            const rsp = toDataQueryResponse(data, [target]);
            if (!rsp) {
                return [];
            }
            const table = this.getTable(rsp.data, target, {});
            const list = [];
            let titleColIndex = 0;
            let timeColIndex = 0;
            let timeEndColIndex = 0;
            let textColIndex = 0;
            const tagsColIndexes = [];
            each(table.columns, (column, index) => {
                if (column.text.toLowerCase() === 'time') {
                    timeColIndex = index;
                    return;
                }
                if (column.text === annotation.titleColumn) {
                    titleColIndex = index;
                    return;
                }
                if (colContainsTag(column.text, annotation.tagsColumn)) {
                    tagsColIndexes.push(index);
                    return;
                }
                if (annotation.textColumn && column.text.includes(annotation.textColumn)) {
                    textColIndex = index;
                    return;
                }
                if (column.text === annotation.timeEndColumn) {
                    timeEndColIndex = index;
                    return;
                }
                // legacy case
                if (!titleColIndex && textColIndex !== index) {
                    titleColIndex = index;
                }
            });
            each(table.rows, (value) => {
                const data = {
                    annotation: annotation,
                    time: +new Date(value[timeColIndex]),
                    title: value[titleColIndex],
                    timeEnd: value[timeEndColIndex],
                    // Remove empty values, then split in different tags for comma separated values
                    tags: flatten(tagsColIndexes
                        .filter((t) => {
                        return value[t];
                    })
                        .map((t) => {
                        return value[t].split(',');
                    })),
                    text: value[textColIndex],
                };
                list.push(data);
            });
            return list;
        });
    }
}
function colContainsTag(colText, tagsColumn) {
    const tags = (tagsColumn || '').replace(' ', '').split(',');
    for (const tag of tags) {
        if (tag !== '' && colText.includes(tag)) {
            return true;
        }
    }
    return false;
}
function getTableCols(dfs, table, target) {
    const selectedParams = getSelectedParams(target);
    dfs[0].fields.forEach((field) => {
        // Time col
        if (field.name.toLowerCase() === 'time') {
            table.columns.push({ text: 'Time', type: FieldType.time });
        }
        // Group by (label) column(s)
        else if (field.name.toLowerCase() === 'value') {
            if (field.labels) {
                Object.keys(field.labels).forEach((key) => {
                    table.columns.push({ text: key });
                });
            }
        }
    });
    // Get cols for annotationQuery
    if (dfs[0].refId === 'metricFindQuery') {
        dfs.forEach((field) => {
            if (field.name) {
                table.columns.push({ text: field.name });
            }
        });
    }
    // Select (metric) column(s)
    for (let i = 0; i < selectedParams.length; i++) {
        table.columns.push({ text: selectedParams[i] });
    }
    // ISSUE: https://github.com/grafana/grafana/issues/63842
    // if rawQuery and
    // has other selected fields in the query and
    // dfs field names are in the rawQuery but
    // the selected params object doesn't exist in the query then
    // add columns to the table
    if (target.rawQuery &&
        selectedParams.length === 0 &&
        rawQuerySelectedFieldsInDataframe(target.query, dfs) &&
        dfs[0].refId !== 'metricFindQuery') {
        dfs.map((df) => {
            if (df.name) {
                table.columns.push({ text: df.name });
            }
        });
    }
    return table;
}
function getTableRows(dfs, table, labels) {
    const values = dfs[0].fields[0].values;
    for (let i = 0; i < values.length; i++) {
        const time = values[i];
        const metrics = dfs.map((df) => {
            return df.fields[1] ? df.fields[1].values[i] : null;
        });
        if (metrics.indexOf(null) < 0) {
            table.rows.push([time, ...labels, ...metrics]);
        }
    }
    return table;
}
export function getSelectedParams(target) {
    var _a;
    let allParams = [];
    (_a = target.select) === null || _a === void 0 ? void 0 : _a.forEach((select) => {
        var _a, _b;
        const selector = select.filter((x) => x.type !== 'field');
        if (selector.length > 0) {
            const aliasIfExist = selector.find((s) => s.type === 'alias');
            if (aliasIfExist) {
                allParams.push((_b = (_a = aliasIfExist.params) === null || _a === void 0 ? void 0 : _a[0].toString()) !== null && _b !== void 0 ? _b : '');
            }
            else {
                allParams.push(selector[0].type);
            }
        }
        else {
            if (select[0] && select[0].params && select[0].params[0]) {
                allParams.push(select[0].params[0].toString());
            }
        }
    });
    let uniqueParams = [];
    allParams.forEach((param) => {
        uniqueParams.push(incrementName(param, param, uniqueParams, 0));
    });
    return uniqueParams;
}
function incrementName(name, nameIncrement, params, index) {
    if (params.indexOf(nameIncrement) > -1) {
        index++;
        return incrementName(name, name + '_' + index, params, index);
    }
    return nameIncrement;
}
function rawQuerySelectedFieldsInDataframe(query, dfs) {
    const names = dfs.map((df) => df.name);
    const colsInRawQuery = names.every((name) => {
        if (name && query) {
            // table name and field, i.e. cpu.usage_guest_nice becomes ['cpu', 'usage_guest_nice']
            const nameParts = name.split('.');
            return nameParts.every((np) => query.toLowerCase().includes(np.toLowerCase()));
        }
        return false;
    });
    const queryChecks = ['*', 'SHOW'];
    const otherChecks = queryChecks.some((qc) => {
        if (query) {
            return query.toLowerCase().includes(qc.toLowerCase());
        }
        return false;
    });
    return colsInRawQuery || otherChecks;
}
//# sourceMappingURL=response_parser.js.map