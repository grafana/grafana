import { DataLink, DataQuery, ExploreMode, Field, LinkModel, ScopedVars, TimeRange } from '../types';
import { getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
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

export function mapInternalLinkToExplore(
  link: DataLink,
  scopedVars: ScopedVars,
  range: TimeRange,
  field: Field,
  onClickFn?: (options: { datasourceUid: string; query: any }) => void
): LinkModel<Field> {
  if (!link.internal) {
    throw new Error('Trying to map external link as internal');
  }
  const interpolatedQuery = interpolateQuery(link, scopedVars);
  return {
    title: link.title
      ? getTemplateSrv().replace(link.title || '', scopedVars)
      : getDataSourceSrv().getDataSourceSettingsByUid(link.internal.datasourceUid)?.name || 'Unknown datasource',

    // In this case this is meant to be internal link (opens split view by default) the href will also points
    // to explore but this way you can open it in new tab.
    href: generateInternalHref(link.internal.datasourceUid, interpolatedQuery, range),
    onClick: onClickFn
      ? () => {
          onClickFn({
            datasourceUid: link.internal!.datasourceUid,
            query: interpolatedQuery,
          });
        }
      : undefined,
    target: '_self',
    origin: field,
  };
}

/**
 * Generates href for internal derived field link.
 */
function generateInternalHref<T extends DataQuery = any>(datasourceUid: string, query: T, range: TimeRange): string {
  return locationUtil.assureBaseUrl(
    `/explore?left=${serializeStateToUrlParam({
      range: range.raw,
      datasource: getDataSourceSrv().getDataSourceSettingsByUid(datasourceUid)?.name || 'unknown',
      queries: [query],
      // This should get overwritten if datasource does not support that mode and we do not know what mode is
      // preferred anyway.
      mode: ExploreMode.Metrics,
      ui: {
        showingGraph: true,
        showingTable: true,
        showingLogs: true,
      },
    })}`
  );
}

function interpolateQuery<T extends DataQuery = any>(link: DataLink, scopedVars: ScopedVars): T {
  let stringifiedQuery = '';
  try {
    stringifiedQuery = JSON.stringify(link.internal?.query || '');
  } catch (err) {
    // should not happen and not much to do about this, possibly something non stringifiable in the query
    console.error(err);
  }

  // Replace any variables inside the query. This may not be the safest as it can also replace keys etc so may not
  // actually work with every datasource query right now.
  stringifiedQuery = getTemplateSrv().replace(stringifiedQuery, scopedVars);

  let replacedQuery = {} as T;
  try {
    replacedQuery = JSON.parse(stringifiedQuery);
  } catch (err) {
    // again should not happen and not much to do about this, probably some issue with how we replaced the variables.
    console.error(stringifiedQuery, err);
  }

  return replacedQuery;
}
