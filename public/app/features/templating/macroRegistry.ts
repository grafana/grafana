import moment from 'moment-timezone';

import { DataLinkBuiltInVars, getTimeZone, ScopedVars, urlUtil } from '@grafana/data';

import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { getVariablesUrlParams } from '../variables/getAllVariableValuesForUrl';

import { dataMacro, fieldMacro, seriesNameMacro, valueMacro } from './dataMacros';
import { MacroHandler } from './types';

export const macroRegistry: Record<string, MacroHandler> = {
  ['__value']: valueMacro,
  ['__data']: dataMacro,
  ['__series']: seriesNameMacro,
  ['__field']: fieldMacro,
  [DataLinkBuiltInVars.includeVars]: includeVarsMacro,
  [DataLinkBuiltInVars.keepTime]: urlTimeRangeMacro,
  ['__timezone']: timeZoneMacro,
};

function includeVarsMacro(match: string, fieldPath?: string, scopedVars?: ScopedVars) {
  const allVariablesParams = getVariablesUrlParams(scopedVars);
  return urlUtil.toUrlParams(allVariablesParams);
}

function urlTimeRangeMacro() {
  return urlUtil.toUrlParams(getTimeSrv().timeRangeForUrl());
}

function timeZoneMacro() {
  const timeZone = getTimeZone({ timeZone: getTimeSrv().timeModel?.getTimezone() });
  return timeZone === 'browser' ? moment.tz.guess() : timeZone;
}
