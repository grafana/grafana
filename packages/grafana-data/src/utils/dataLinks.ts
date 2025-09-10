import { ScopedVars } from '../types/ScopedVars';
import { Field } from '../types/dataFrame';
import { DataLink, InternalDataLink, LinkModel } from '../types/dataLink';
import { SplitOpen, ExplorePanelsState } from '../types/explore';
import { InterpolateFunction } from '../types/panel';
import { DataQuery } from '../types/query';
import { TimeRange } from '../types/time';

import { locationUtil } from './location';
import { serializeStateToUrlParam, toURLRange } from './url';

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
  range?: TimeRange;
  field: Field;
  internalLink: InternalDataLink;
  onClickFn?: SplitOpen;
  replaceVariables: InterpolateFunction;
};

export function mapInternalLinkToExplore(options: LinkToExploreOptions): LinkModel<Field> {
  const { onClickFn, replaceVariables, link, scopedVars, range, field, internalLink } = options;

  const query =
    typeof link.internal?.query === 'function'
      ? link.internal.query({ replaceVariables, scopedVars })
      : internalLink.query;
  const interpolatedQuery = interpolateObject<DataQuery>(query, scopedVars, replaceVariables) || { refId: 'unknown' };
  const interpolatedPanelsState = interpolateObject(link.internal?.panelsState, scopedVars, replaceVariables);
  const interpolatedCorrelationData = interpolateObject(link.meta?.correlationData, scopedVars, replaceVariables);
  const title = link.title ? link.title : internalLink.datasourceName;

  let meta;

  if (interpolatedQuery) {
    meta = {
      internalLink: {
        interpolated: {
          query: {
            ...interpolatedQuery,
            // data source is defined in a separate property in DataLink, we ensure it's put back together after interpolation
            datasource: {
              ...interpolatedQuery.datasource,
              uid: internalLink.datasourceUid,
            },
          },
          ...(range && { timeRange: range }),
        },
      },
    };
  }

  return {
    title: replaceVariables(title, scopedVars),
    // In this case this is meant to be internal link (opens split view by default) the href will also points
    // to explore but this way you can open it in new tab.
    href: generateInternalHref<DataQuery>(
      internalLink.datasourceUid,
      interpolatedQuery,
      range,
      interpolatedPanelsState
    ),
    onClick: onClickFn
      ? (event) => {
          // Explore data links can be displayed not only in DataLinkButton but it can be used by the consumer in
          // other way, for example MenuItem. We want to provide the URL (for opening in the new tab as well as
          // the onClick to open the split view).
          if (event.preventDefault) {
            event.preventDefault();
          }

          onClickFn({
            datasourceUid: internalLink.datasourceUid,
            queries: [interpolatedQuery],
            panelsState: interpolatedPanelsState,
            correlationHelperData: interpolatedCorrelationData,
            range,
          });
        }
      : undefined,
    target: link?.targetBlank ? '_blank' : '_self',
    origin: field,
    meta,
  };
}

/**
 * Generates href for internal derived field link.
 */
function generateInternalHref<T extends DataQuery>(
  datasourceUid: string,
  query: T,
  range?: TimeRange,
  panelsState?: ExplorePanelsState
): string {
  return locationUtil.assureBaseUrl(
    `/explore?left=${encodeURIComponent(
      serializeStateToUrlParam({
        // @deprecated mapInternalLinkToExplore required passing range. Some consumers to generate the URL
        // with defaults pass range as `{} as any`. This is why we need to check for `range?.raw` not just
        // `range ? ...` here. This behavior will be marked as deprecated in #72498
        ...(range?.raw ? { range: toURLRange(range.raw) } : {}),
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
