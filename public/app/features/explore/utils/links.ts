import { splitOpen } from '../state/actions';
import { ExploreMode, Field, LinkModel, locationUtil, TimeRange } from '@grafana/data';
import { getLinksFromLogsField } from '../../panel/panellinks/linkSuppliers';
import { serializeStateToUrlParam } from '../../../core/utils/explore';
import { getDataSourceSrv } from '@grafana/runtime';

/**
 * Get links from the field of a dataframe and in addition check if there is associated
 * metadata with datasource in which case we will add onClick to open the link in new split window. This assumes
 * that we just supply datasource name and field value and Explore split window will know how to render that
 * appropriately. This is for example used for transition from log with traceId to trace datasource to show that
 * trace.
 */
export function getFieldLinksForExplore(
  field: Field,
  rowIndex: number,
  splitOpenFn: typeof splitOpen,
  range: TimeRange
): Array<LinkModel<Field>> {
  const data = getLinksFromLogsField(field, rowIndex);
  return data.map(d => {
    if (d.link.meta?.datasourceUid) {
      return {
        ...d.linkModel,
        title:
          d.linkModel.title ||
          getDataSourceSrv().getDataSourceSettingsByUid(d.link.meta.datasourceUid)?.name ||
          'Unknown datasource',
        onClick: () => {
          splitOpenFn({
            datasourceUid: d.link.meta.datasourceUid,
            // TODO: fix the ambiguity here
            // This looks weird but in case meta.datasourceUid is set we save the query in url which will get
            // interpolated into href
            query: d.linkModel.href,
          });
        },
        // We need to create real href here as the linkModel.href actually contains query. As in this case this is
        // meant to be internal link (opens split view by default) the href will also points to explore but this
        // way you can open it in new tab.
        href: generateInternalHref(d.link.meta.datasourceUid, d.linkModel.href, range),
      };
    }

    if (!d.linkModel.title) {
      let href = d.linkModel.href;
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

      return {
        ...d.linkModel,
        title,
      };
    }
    return d.linkModel;
  });
}

/**
 * Generates href for internal derived field link.
 */
function generateInternalHref(datasourceUid: string, query: string, range: TimeRange): string {
  return locationUtil.assureBaseUrl(
    `/explore?left=${serializeStateToUrlParam({
      range: range.raw,
      datasource: getDataSourceSrv().getDataSourceSettingsByUid(datasourceUid).name,
      // Again hardcoded for Jaeger query structure
      // TODO: fix
      queries: [{ query }],
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
