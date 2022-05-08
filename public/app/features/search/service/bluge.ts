import { lastValueFrom } from 'rxjs';

import { DataFrame, DataFrameView } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import { GrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { DashboardQueryResult, GrafanaSearcher, QueryResponse, SearchQuery, SearchResultMeta } from '.';

export class BlugeSearcher implements GrafanaSearcher {
  async search(query: SearchQuery): Promise<QueryResponse> {
    return doSearchQuery(query);
  }

  async list(location: string): Promise<QueryResponse> {
    return doSearchQuery({ query: `list:${location ?? ''}` });
  }
}

export async function doSearchQuery(query: SearchQuery): Promise<QueryResponse> {
  const qstr = query.query ?? '*';
  const ds = (await getDataSourceSrv().get('-- Grafana --')) as GrafanaDatasource;
  const rsp = await lastValueFrom(
    ds.query({
      targets: [{ ...query, refId: 'A', queryType: GrafanaQueryType.Search, query: qstr }],
    } as any)
  );

  const first = (rsp.data?.[0] as DataFrame) ?? { fields: [], length: 0 };
  const view = new DataFrameView<DashboardQueryResult>(first);
  const meta = first.meta?.custom as SearchResultMeta;
  if (rsp.data.length > 1) {
    for (let i = 1; i < rsp.data.length; i++) {
      const frame = rsp.data[i] as DataFrame;
      if (frame.fields[0]?.name === 'tag') {
        return {
          view,
          meta,
          tags: getTermCountsFrom(frame),
        };
      }
    }
  }

  return {
    view,
    meta,
  };
}

function getTermCountsFrom(frame: DataFrame): TermCount[] {
  const keys = frame.fields[0].values;
  const vals = frame.fields[1].values;
  const counts: TermCount[] = [];
  for (let i = 0; i < frame.length; i++) {
    counts.push({ term: keys.get(i), count: vals.get(i) });
  }
  return counts;
}
