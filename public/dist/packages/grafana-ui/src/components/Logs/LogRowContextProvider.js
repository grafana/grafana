import { __awaiter, __generator, __read } from "tslib";
import { toDataFrame, FieldCache, LogsSortOrder, } from '@grafana/data';
import { useState, useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';
export var getRowContexts = function (getRowContext, row, limit, logsSortOrder) { return __awaiter(void 0, void 0, void 0, function () {
    var promises, results, data, errors;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                promises = [
                    getRowContext(row, {
                        limit: limit,
                    }),
                    getRowContext(row, {
                        // The start time is inclusive so we will get the one row we are using as context entry
                        limit: limit + 1,
                        direction: 'FORWARD',
                    }),
                ];
                return [4 /*yield*/, Promise.all(promises.map(function (p) { return p.catch(function (e) { return e; }); }))];
            case 1:
                results = _a.sent();
                data = results.map(function (result) {
                    var dataResult = result;
                    if (!dataResult.data) {
                        return [];
                    }
                    var data = [];
                    for (var index = 0; index < dataResult.data.length; index++) {
                        var dataFrame = toDataFrame(dataResult.data[index]);
                        var fieldCache = new FieldCache(dataFrame);
                        var timestampField = fieldCache.getFieldByName('ts');
                        var idField = fieldCache.getFieldByName('id');
                        for (var fieldIndex = 0; fieldIndex < timestampField.values.length; fieldIndex++) {
                            // TODO: this filtering is datasource dependant so it will make sense to move it there so the API is
                            //  to return correct list of lines handling inclusive ranges or how to filter the correct line on the
                            //  datasource.
                            // Filter out the row that is the one used as a focal point for the context as we will get it in one of the
                            // requests.
                            if (idField) {
                                // For Loki this means we filter only the one row. Issue is we could have other rows logged at the same
                                // ns which came before but they come in the response that search for logs after. This means right now
                                // we will show those as if they came after. This is not strictly correct but seems better than losing them
                                // and making this correct would mean quite a bit of complexity to shuffle things around and messing up
                                //counts.
                                if (idField.values.get(fieldIndex) === row.uid) {
                                    continue;
                                }
                            }
                            else {
                                // Fallback to timestamp. This should not happen right now as this feature is implemented only for loki
                                // and that has ID. Later this branch could be used in other DS but mind that this could also filter out
                                // logs which were logged in the same timestamp and that can be a problem depending on the precision.
                                if (parseInt(timestampField.values.get(fieldIndex), 10) === row.timeEpochMs) {
                                    continue;
                                }
                            }
                            var lineField = dataFrame.fields.filter(function (field) { return field.name === 'line'; })[0];
                            var line = lineField.values.get(fieldIndex); // assuming that both fields have same length
                            data.push(line);
                        }
                    }
                    return logsSortOrder === LogsSortOrder.Ascending ? data.reverse() : data;
                });
                errors = results.map(function (result) {
                    var errorResult = result;
                    if (!errorResult.message) {
                        return '';
                    }
                    return errorResult.message;
                });
                return [2 /*return*/, {
                        data: logsSortOrder === LogsSortOrder.Ascending ? data.reverse() : data,
                        errors: logsSortOrder === LogsSortOrder.Ascending ? errors.reverse() : errors,
                    }];
        }
    });
}); };
export var LogRowContextProvider = function (_a) {
    var getRowContext = _a.getRowContext, row = _a.row, children = _a.children, logsSortOrder = _a.logsSortOrder;
    // React Hook that creates a number state value called limit to component state and a setter function called setLimit
    // The initial value for limit is 10
    // Used for the number of rows to retrieve from backend from a specific point in time
    var _b = __read(useState(10), 2), limit = _b[0], setLimit = _b[1];
    // React Hook that creates an object state value called result to component state and a setter function called setResult
    // The initial value for result is null
    // Used for sorting the response from backend
    var _c = __read(useState(null), 2), result = _c[0], setResult = _c[1];
    // React Hook that creates an object state value called hasMoreContextRows to component state and a setter function called setHasMoreContextRows
    // The initial value for hasMoreContextRows is {before: true, after: true}
    // Used for indicating in UI if there are more rows to load in a given direction
    var _d = __read(useState({
        before: true,
        after: true,
    }), 2), hasMoreContextRows = _d[0], setHasMoreContextRows = _d[1];
    // React Hook that resolves two promises every time the limit prop changes
    // First promise fetches limit number of rows backwards in time from a specific point in time
    // Second promise fetches limit number of rows forwards in time from a specific point in time
    var value = useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getRowContexts(getRowContext, row, limit, logsSortOrder)];
                case 1: return [2 /*return*/, _a.sent()]; // Moved it to a separate function for debugging purposes
            }
        });
    }); }, [limit]).value;
    // React Hook that performs a side effect every time the value (from useAsync hook) prop changes
    // The side effect changes the result state with the response from the useAsync hook
    // The side effect changes the hasMoreContextRows state if there are more context rows before or after the current result
    useEffect(function () {
        if (value) {
            setResult(function (currentResult) {
                var hasMoreLogsBefore = true, hasMoreLogsAfter = true;
                var currentResultBefore = currentResult === null || currentResult === void 0 ? void 0 : currentResult.data[0];
                var currentResultAfter = currentResult === null || currentResult === void 0 ? void 0 : currentResult.data[1];
                var valueBefore = value.data[0];
                var valueAfter = value.data[1];
                // checks if there are more log rows in a given direction
                // if after fetching additional rows the length of result is the same,
                // we can assume there are no logs in that direction within a given time range
                if (currentResult && (!valueBefore || currentResultBefore.length === valueBefore.length)) {
                    hasMoreLogsBefore = false;
                }
                if (currentResult && (!valueAfter || currentResultAfter.length === valueAfter.length)) {
                    hasMoreLogsAfter = false;
                }
                setHasMoreContextRows({
                    before: hasMoreLogsBefore,
                    after: hasMoreLogsAfter,
                });
                return value;
            });
        }
    }, [value]);
    return children({
        result: {
            before: result ? result.data[0] : [],
            after: result ? result.data[1] : [],
        },
        errors: {
            before: result ? result.errors[0] : undefined,
            after: result ? result.errors[1] : undefined,
        },
        hasMoreContextRows: hasMoreContextRows,
        updateLimit: function () { return setLimit(limit + 10); },
        limit: limit,
    });
};
//# sourceMappingURL=LogRowContextProvider.js.map