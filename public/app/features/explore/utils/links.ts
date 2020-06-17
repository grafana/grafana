import { splitOpen } from '../state/actions';
import { DataLink, DataQuery, ExploreMode, Field, LinkModel, locationUtil, ScopedVars, TimeRange } from '@grafana/data';
import { serializeStateToUrlParam } from '../../../core/utils/explore';
import { getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { getLinkSrv } from '../../panel/panellinks/link_srv';

/**
 * Generates href for internal derived field link.
 */
function generateInternalHref<T extends DataQuery = any>(datasourceUid: string, query: T, range: TimeRange): string {
  return locationUtil.assureBaseUrl(
    `/explore?left=${serializeStateToUrlParam({
      range: range.raw,
      datasource: getDataSourceSrv().getDataSourceSettingsByUid(datasourceUid).name,
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
    stringifiedQuery = JSON.stringify(link.internal.query);
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

/**
 * Get links from the field of a dataframe and in addition check if there is associated
 * metadata with datasource in which case we will add onClick to open the link in new split window. This assumes
 * that we just supply datasource name and field value and Explore split window will know how to render that
 * appropriately. This is for example used for transition from log with traceId to trace datasource to show that
 * trace.
 */
export const getFieldLinksForExplore = (
  field: Field,
  rowIndex: number,
  splitOpenFn: typeof splitOpen,
  range: TimeRange
): Array<LinkModel<Field>> => {
  const scopedVars: any = {};
  scopedVars['__value'] = {
    value: {
      raw: field.values.get(rowIndex),
    },
    text: 'Raw value',
  };

  return field.config.links
    ? field.config.links.map(link => {
        if (!link.internal) {
          const linkModel = getLinkSrv().getDataLinkUIModel(link, scopedVars, field);
          if (!linkModel.title) {
            linkModel.title = getTitleFromHref(linkModel.href);
          }
          return linkModel;
        } else {
          return mapInternalLink(link, scopedVars, range, splitOpenFn, field);
        }
      })
    : [];
};

function mapInternalLink(
  link: DataLink,
  scopedVars: ScopedVars,
  range: TimeRange,
  splitOpenFn: typeof splitOpen,
  field: Field
): LinkModel<Field> {
  const interpolatedQuery = interpolateQuery(link, scopedVars);
  return {
    title: link.title
      ? getTemplateSrv().replace(link.title || '', scopedVars)
      : getDataSourceSrv().getDataSourceSettingsByUid(link.internal.datasourceUid)?.name || 'Unknown datasource',

    // In this case this is meant to be internal link (opens split view by default) the href will also points
    // to explore but this way you can open it in new tab.
    href: generateInternalHref(link.internal.datasourceUid, link.internal.query, range),
    onClick: () => {
      splitOpenFn({
        datasourceUid: link.internal.datasourceUid,
        query: interpolatedQuery,
      });
    },
    target: '_self',
    origin: field,
  };
}

function getTitleFromHref(href: string): string {
  // The URL constructor needs the url to have protocol
  if (href.indexOf('://') < 0) {
    // Doesn't really matter what protocol we use.
    href = `http://${href}`;
  }
  let title;
  try {
    const parsedUrl = new URL(href);
    title = parsedUrl.hostname;
  } catch (_e) {
    // Should be good enough fallback, user probably did not input valid url.
    title = href;
  }
  return title;
}
