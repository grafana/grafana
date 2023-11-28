import { __awaiter } from "tslib";
import { getDataSourceSrv } from '@grafana/runtime';
import { encodeUrl } from '../aws_url';
export function addDataLinksToLogsResponse(response, request, range, replaceFn, getVariableValueFn, getRegion, tracingDatasourceUid) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const replace = (target, fieldName) => replaceFn(target, request.scopedVars, false, fieldName);
        const getVariableValue = (target) => getVariableValueFn(target, request.scopedVars);
        for (const dataFrame of response.data) {
            const curTarget = request.targets.find((target) => target.refId === dataFrame.refId);
            const interpolatedRegion = getRegion(replace((_a = curTarget.region) !== null && _a !== void 0 ? _a : '', 'region'));
            for (const field of dataFrame.fields) {
                if (field.name === '@xrayTraceId' && tracingDatasourceUid) {
                    getRegion(replace((_b = curTarget.region) !== null && _b !== void 0 ? _b : '', 'region'));
                    const xrayLink = yield createInternalXrayLink(tracingDatasourceUid, interpolatedRegion);
                    if (xrayLink) {
                        field.config.links = [xrayLink];
                    }
                }
                else {
                    // Right now we add generic link to open the query in xray console to every field so it shows in the logs row
                    // details. Unfortunately this also creates link for all values inside table which look weird.
                    field.config.links = [createAwsConsoleLink(curTarget, range, interpolatedRegion, replace, getVariableValue)];
                }
            }
        }
    });
}
function createInternalXrayLink(datasourceUid, region) {
    return __awaiter(this, void 0, void 0, function* () {
        let ds;
        try {
            ds = yield getDataSourceSrv().get(datasourceUid);
        }
        catch (e) {
            console.error('Could not load linked xray data source, it was probably deleted after it was linked', e);
            return undefined;
        }
        return {
            title: ds.name,
            url: '',
            internal: {
                query: { query: '${__value.raw}', queryType: 'getTrace', region: region },
                datasourceUid: datasourceUid,
                datasourceName: ds.name,
            },
        };
    });
}
function createAwsConsoleLink(target, range, region, replace, getVariableValue) {
    var _a, _b;
    const arns = ((_a = target.logGroups) !== null && _a !== void 0 ? _a : [])
        .filter((group) => group === null || group === void 0 ? void 0 : group.arn)
        .map((group) => { var _a; return ((_a = group.arn) !== null && _a !== void 0 ? _a : '').replace(/:\*$/, ''); }); // remove `:*` from end of arn
    const logGroupNames = (_b = target.logGroupNames) !== null && _b !== void 0 ? _b : [];
    const sources = (arns === null || arns === void 0 ? void 0 : arns.length) ? arns : logGroupNames;
    const interpolatedExpression = target.expression ? replace(target.expression) : '';
    const interpolatedGroups = sources === null || sources === void 0 ? void 0 : sources.flatMap(getVariableValue);
    const urlProps = {
        end: range.to.toISOString(),
        start: range.from.toISOString(),
        timeType: 'ABSOLUTE',
        tz: 'UTC',
        editorString: interpolatedExpression,
        isLiveTail: false,
        source: interpolatedGroups,
    };
    const encodedUrl = encodeUrl(urlProps, region);
    return {
        url: encodedUrl,
        title: 'View in CloudWatch console',
        targetBlank: true,
    };
}
//# sourceMappingURL=datalinks.js.map