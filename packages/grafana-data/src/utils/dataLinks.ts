import {
  DataLink,
  DataQuery,
  ExplorePanelsState,
  Field,
  InternalDataLink,
  InterpolateFunction,
  LinkModel,
  ScopedVars,
  SplitOpen,
  TimeRange,
} from '../types';

import { locationUtil } from './location';
import { serializeStateToUrlParam } from './url';

export const DataLinkBuiltInVars = {
  keepTime: '__url_time_range',
  timeRangeFrom: '__from',
  timeRangeTo: '__to',
  includeVars: '__all_variables',
  seriesName: '__series.name',
  fieldName: '__field.name',
  valueTime: '__value.time',
  valueNumeric: '__value.numeric',
  valueText: '__value.text',
  valueRaw: '__value.raw',
  // name of the calculation represented by the value
  valueCalc: '__value.calc',
};

// We inject these because we cannot import them directly as they reside inside grafana main package.
export type LinkToExploreOptions = {
  link: DataLink;
  scopedVars: ScopedVars;
  range: TimeRange;
  field: Field;
  internalLink: InternalDataLink;
  onClickFn?: SplitOpen;
  replaceVariables: InterpolateFunction;
  variableMap?: Record<string, string | number | boolean | undefined>;
};

export function mapInternalLinkToExplore(options: LinkToExploreOptions): LinkModel<Field> {
  const { onClickFn, replaceVariables, link, scopedVars, range, field, internalLink, variableMap } = options;

  const interpolatedQuery = interpolateObject(link.internal?.query, scopedVars, replaceVariables);
  const interpolatedPanelsState = interpolateObject(link.internal?.panelsState, scopedVars, replaceVariables);
  const title = link.title ? link.title : internalLink.datasourceName;

  return {
    title: replaceVariables(title, scopedVars),
    // In this case this is meant to be internal link (opens split view by default) the href will also points
    // to explore but this way you can open it in new tab.
    href: generateInternalHref(internalLink.datasourceUid, interpolatedQuery, range, interpolatedPanelsState),
    onClick: onClickFn
      ? () => {
          onClickFn({
            datasourceUid: internalLink.datasourceUid,
            query: interpolatedQuery,
            panelsState: interpolatedPanelsState,
            range,
          });
        }
      : undefined,
    target: link?.targetBlank ? '_blank' : '_self',
    origin: field,
    variableMap,
  };
}

/**
 * Generates href for internal derived field link.
 */
function generateInternalHref<T extends DataQuery = any>(
  datasourceUid: string,
  query: T,
  range: TimeRange,
  panelsState?: ExplorePanelsState
): string {
  return locationUtil.assureBaseUrl(
    `/explore?left=${encodeURIComponent(
      serializeStateToUrlParam({
        range: range.raw,
        datasource: datasourceUid,
        queries: [query],
        panelsState: panelsState,
      })
    )}`
  );
}

function interpolateObject<T>(
  obj: T | undefined,
  scopedVars: ScopedVars,
  replaceVariables: InterpolateFunction
): T | undefined {
  if (!obj) {
    return obj;
  }
  if (typeof obj === 'string') {
    // @ts-ignore this is complaining we are returning string, but we are checking if obj is a string so should be fine.
    return replaceVariables(obj, scopedVars);
  }
  const copy = JSON.parse(JSON.stringify(obj));
  return interpolateObjectRecursive(copy, scopedVars, replaceVariables);
}

function interpolateObjectRecursive<T extends Object>(
  obj: T,
  scopedVars: ScopedVars,
  replaceVariables: InterpolateFunction
): T {
  for (const k of Object.keys(obj)) {
    // Honestly not sure how to type this to make TS happy.
    // @ts-ignore
    if (typeof obj[k] === 'string') {
      // @ts-ignore
      obj[k] = replaceVariables(obj[k], scopedVars);
      // @ts-ignore
    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
      // @ts-ignore
      obj[k] = interpolateObjectRecursive(obj[k], scopedVars, replaceVariables);
    }
  }
  return obj;
}

/**
 * Use variable map from templateSrv to determine if all variables have values
 * @param query
 * @param scopedVars
 * @param getVarMap
 */
export function dataLinkHasAllVariablesDefined<T extends DataLink>(
  query: T,
  scopedVars: ScopedVars,
  getVarMap: Function
): { variableMap: Record<string, string | number | boolean | undefined>; allVariablesDefined: boolean } {
  const vars = getVarMap(getStringsFromObject(query), scopedVars);
  return {
    variableMap: vars,
    allVariablesDefined: Object.values(vars).every((val) => val !== undefined && val !== null),
  };
}

function getStringsFromObject(obj: Object): string {
  let acc = '';
  let k: keyof typeof obj;

  for (k in obj) {
    if (typeof obj[k] === 'string') {
      acc += ' ' + obj[k];
    } else if (typeof obj[k] === 'object') {
      acc += ' ' + getStringsFromObject(obj[k]);
    }
  }
  return acc;
}
