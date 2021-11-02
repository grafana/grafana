import { __awaiter, __generator, __values } from "tslib";
import { encodeUrl } from '../aws_url';
import { getDataSourceSrv } from '@grafana/runtime';
export function addDataLinksToLogsResponse(response, request, range, replaceFn, getRegion, tracingDatasourceUid) {
    return __awaiter(this, void 0, void 0, function () {
        var replace, _loop_1, _a, _b, dataFrame, e_1_1;
        var e_1, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    replace = function (target, fieldName) { return replaceFn(target, request.scopedVars, true, fieldName); };
                    _loop_1 = function (dataFrame) {
                        var curTarget, interpolatedRegion, _e, _f, field, xrayLink, e_2_1;
                        var e_2, _g;
                        return __generator(this, function (_h) {
                            switch (_h.label) {
                                case 0:
                                    curTarget = request.targets.find(function (target) { return target.refId === dataFrame.refId; });
                                    interpolatedRegion = getRegion(replace(curTarget.region, 'region'));
                                    _h.label = 1;
                                case 1:
                                    _h.trys.push([1, 7, 8, 9]);
                                    _e = (e_2 = void 0, __values(dataFrame.fields)), _f = _e.next();
                                    _h.label = 2;
                                case 2:
                                    if (!!_f.done) return [3 /*break*/, 6];
                                    field = _f.value;
                                    if (!(field.name === '@xrayTraceId' && tracingDatasourceUid)) return [3 /*break*/, 4];
                                    getRegion(replace(curTarget.region, 'region'));
                                    return [4 /*yield*/, createInternalXrayLink(tracingDatasourceUid, interpolatedRegion)];
                                case 3:
                                    xrayLink = _h.sent();
                                    if (xrayLink) {
                                        field.config.links = [xrayLink];
                                    }
                                    return [3 /*break*/, 5];
                                case 4:
                                    // Right now we add generic link to open the query in xray console to every field so it shows in the logs row
                                    // details. Unfortunately this also creates link for all values inside table which look weird.
                                    field.config.links = [createAwsConsoleLink(curTarget, range, interpolatedRegion, replace)];
                                    _h.label = 5;
                                case 5:
                                    _f = _e.next();
                                    return [3 /*break*/, 2];
                                case 6: return [3 /*break*/, 9];
                                case 7:
                                    e_2_1 = _h.sent();
                                    e_2 = { error: e_2_1 };
                                    return [3 /*break*/, 9];
                                case 8:
                                    try {
                                        if (_f && !_f.done && (_g = _e.return)) _g.call(_e);
                                    }
                                    finally { if (e_2) throw e_2.error; }
                                    return [7 /*endfinally*/];
                                case 9: return [2 /*return*/];
                            }
                        });
                    };
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 6, 7, 8]);
                    _a = __values(response.data), _b = _a.next();
                    _d.label = 2;
                case 2:
                    if (!!_b.done) return [3 /*break*/, 5];
                    dataFrame = _b.value;
                    return [5 /*yield**/, _loop_1(dataFrame)];
                case 3:
                    _d.sent();
                    _d.label = 4;
                case 4:
                    _b = _a.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_1_1 = _d.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function createInternalXrayLink(datasourceUid, region) {
    return __awaiter(this, void 0, void 0, function () {
        var ds, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getDataSourceSrv().get(datasourceUid)];
                case 1:
                    ds = _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    e_3 = _a.sent();
                    console.error('Could not load linked xray data source, it was probably deleted after it was linked', e_3);
                    return [2 /*return*/, undefined];
                case 3: return [2 /*return*/, {
                        title: ds.name,
                        url: '',
                        internal: {
                            query: { query: '${__value.raw}', queryType: 'getTrace', region: region },
                            datasourceUid: datasourceUid,
                            datasourceName: ds.name,
                        },
                    }];
            }
        });
    });
}
function createAwsConsoleLink(target, range, region, replace) {
    var _a, _b;
    var interpolatedExpression = target.expression ? replace(target.expression) : '';
    var interpolatedGroups = (_b = (_a = target.logGroupNames) === null || _a === void 0 ? void 0 : _a.map(function (logGroup) { return replace(logGroup, 'log groups'); })) !== null && _b !== void 0 ? _b : [];
    var urlProps = {
        end: range.to.toISOString(),
        start: range.from.toISOString(),
        timeType: 'ABSOLUTE',
        tz: 'UTC',
        editorString: interpolatedExpression,
        isLiveTail: false,
        source: interpolatedGroups,
    };
    var encodedUrl = encodeUrl(urlProps, region);
    return {
        url: encodedUrl,
        title: 'View in CloudWatch console',
        targetBlank: true,
    };
}
//# sourceMappingURL=datalinks.js.map