import { splitOpen } from '../state/actions';
import { Field, LinkModel, TimeRange } from '@grafana/data';
import { getLinkSrv } from '../../panel/panellinks/link_srv';
import { mapInternalLinkToExplore } from '@grafana/data/src/utils/dataLinks';
import { getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';

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
          return mapInternalLinkToExplore(link, scopedVars, range, field, {
            onClickFn: splitOpenFn,
            replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
            getDataSourceSettingsByUid: getDataSourceSrv().getDataSourceSettingsByUid.bind(getDataSourceSrv()),
          });
        }
      })
    : [];
};

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
