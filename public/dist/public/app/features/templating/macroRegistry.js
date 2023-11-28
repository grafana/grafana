import moment from 'moment-timezone';
import { DataLinkBuiltInVars, getTimeZone, urlUtil } from '@grafana/data';
import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { getVariablesUrlParams } from '../variables/getAllVariableValuesForUrl';
import { dataMacro, fieldMacro, seriesNameMacro, valueMacro } from './dataMacros';
export const macroRegistry = {
    ['__value']: valueMacro,
    ['__data']: dataMacro,
    ['__series']: seriesNameMacro,
    ['__field']: fieldMacro,
    [DataLinkBuiltInVars.includeVars]: includeVarsMacro,
    [DataLinkBuiltInVars.keepTime]: urlTimeRangeMacro,
    ['__timezone']: timeZoneMacro,
};
function includeVarsMacro(match, fieldPath, scopedVars) {
    const allVariablesParams = getVariablesUrlParams(scopedVars);
    return urlUtil.toUrlParams(allVariablesParams);
}
function urlTimeRangeMacro() {
    return urlUtil.toUrlParams(getTimeSrv().timeRangeForUrl());
}
function timeZoneMacro() {
    var _a;
    const timeZone = getTimeZone({ timeZone: (_a = getTimeSrv().timeModel) === null || _a === void 0 ? void 0 : _a.getTimezone() });
    return timeZone === 'browser' ? moment.tz.guess() : timeZone;
}
//# sourceMappingURL=macroRegistry.js.map