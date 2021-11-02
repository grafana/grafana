import { __values } from "tslib";
import { LoadingState, toDataFrame, FieldType, dataFrameFromJSON, } from '@grafana/data';
/**
 * Parse the results from /api/ds/query into a DataQueryResponse
 *
 * @param res - the HTTP response data.
 * @param queries - optional DataQuery array that will order the response based on the order of query refId's.
 *
 * @public
 */
export function toDataQueryResponse(res, queries) {
    var e_1, _a, e_2, _b, e_3, _c, e_4, _d, e_5, _e;
    var _f, _g, _h, _j;
    var rsp = { data: [], state: LoadingState.Done };
    // If the response isn't in a correct shape we just ignore the data and pass empty DataQueryResponse.
    if ((_f = res.data) === null || _f === void 0 ? void 0 : _f.results) {
        var results = res.data.results;
        var refIDs = (queries === null || queries === void 0 ? void 0 : queries.length) ? queries.map(function (q) { return q.refId; }) : Object.keys(results);
        var data = [];
        try {
            for (var refIDs_1 = __values(refIDs), refIDs_1_1 = refIDs_1.next(); !refIDs_1_1.done; refIDs_1_1 = refIDs_1.next()) {
                var refId = refIDs_1_1.value;
                var dr = results[refId];
                if (!dr) {
                    continue;
                }
                dr.refId = refId;
                data.push(dr);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (refIDs_1_1 && !refIDs_1_1.done && (_a = refIDs_1.return)) _a.call(refIDs_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                var dr = data_1_1.value;
                if (dr.error) {
                    if (!rsp.error) {
                        rsp.error = {
                            refId: dr.refId,
                            message: dr.error,
                        };
                        rsp.state = LoadingState.Error;
                    }
                }
                if ((_g = dr.frames) === null || _g === void 0 ? void 0 : _g.length) {
                    try {
                        for (var _k = (e_3 = void 0, __values(dr.frames)), _l = _k.next(); !_l.done; _l = _k.next()) {
                            var js = _l.value;
                            var df = dataFrameFromJSON(js);
                            if (!df.refId) {
                                df.refId = dr.refId;
                            }
                            rsp.data.push(df);
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_l && !_l.done && (_c = _k.return)) _c.call(_k);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                    continue; // the other tests are legacy
                }
                if ((_h = dr.series) === null || _h === void 0 ? void 0 : _h.length) {
                    try {
                        for (var _m = (e_4 = void 0, __values(dr.series)), _o = _m.next(); !_o.done; _o = _m.next()) {
                            var s = _o.value;
                            if (!s.refId) {
                                s.refId = dr.refId;
                            }
                            rsp.data.push(toDataFrame(s));
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (_o && !_o.done && (_d = _m.return)) _d.call(_m);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                }
                if ((_j = dr.tables) === null || _j === void 0 ? void 0 : _j.length) {
                    try {
                        for (var _p = (e_5 = void 0, __values(dr.tables)), _q = _p.next(); !_q.done; _q = _p.next()) {
                            var s = _q.value;
                            if (!s.refId) {
                                s.refId = dr.refId;
                            }
                            rsp.data.push(toDataFrame(s));
                        }
                    }
                    catch (e_5_1) { e_5 = { error: e_5_1 }; }
                    finally {
                        try {
                            if (_q && !_q.done && (_e = _p.return)) _e.call(_p);
                        }
                        finally { if (e_5) throw e_5.error; }
                    }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (data_1_1 && !data_1_1.done && (_b = data_1.return)) _b.call(data_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    // When it is not an OK response, make sure the error gets added
    if (res.status && res.status !== 200) {
        if (rsp.state !== LoadingState.Error) {
            rsp.state = LoadingState.Error;
        }
        if (!rsp.error) {
            rsp.error = toDataQueryError(res);
        }
    }
    return rsp;
}
/**
 * Data sources using api/ds/query to test data sources can use this function to
 * handle errors and convert them to TestingStatus object.
 *
 * If possible, this should be avoided in favor of implementing /health endpoint
 * and testing data source with DataSourceWithBackend.testDataSource()
 *
 * Re-thrown errors are handled by testDataSource() in public/app/features/datasources/state/actions.ts
 *
 * @returns {TestingStatus}
 */
export function toTestingStatus(err) {
    var _a, _b, _c, _d, _e, _f;
    var queryResponse = toDataQueryResponse(err);
    // POST api/ds/query errors returned as { message: string, error: string } objects
    if ((_b = (_a = queryResponse.error) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) {
        return {
            status: 'error',
            message: queryResponse.error.data.message,
            details: ((_d = (_c = queryResponse.error) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) ? { message: queryResponse.error.data.error } : undefined,
        };
    }
    // POST api/ds/query errors returned in results object
    else if (((_e = queryResponse.error) === null || _e === void 0 ? void 0 : _e.refId) && ((_f = queryResponse.error) === null || _f === void 0 ? void 0 : _f.message)) {
        return {
            status: 'error',
            message: queryResponse.error.message,
        };
    }
    throw err;
}
/**
 * Convert an object into a DataQueryError -- if this is an HTTP response,
 * it will put the correct values in the error field
 *
 * @public
 */
export function toDataQueryError(err) {
    var error = (err || {});
    if (!error.message) {
        if (typeof err === 'string' || err instanceof String) {
            return { message: err };
        }
        var message = 'Query error';
        if (error.message) {
            message = error.message;
        }
        else if (error.data && error.data.message) {
            message = error.data.message;
        }
        else if (error.data && error.data.error) {
            message = error.data.error;
        }
        else if (error.status) {
            message = "Query error: " + error.status + " " + error.statusText;
        }
        error.message = message;
    }
    return error;
}
/**
 * Return the first string or non-time field as the value
 *
 * @beta
 */
export function frameToMetricFindValue(frame) {
    if (!frame || !frame.length) {
        return [];
    }
    var values = [];
    var field = frame.fields.find(function (f) { return f.type === FieldType.string; });
    if (!field) {
        field = frame.fields.find(function (f) { return f.type !== FieldType.time; });
    }
    if (field) {
        for (var i = 0; i < field.values.length; i++) {
            values.push({ text: '' + field.values.get(i) });
        }
    }
    return values;
}
//# sourceMappingURL=queryResponse.js.map