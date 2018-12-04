import _ from 'lodash';

import { renderUrl } from 'app/core/utils/url';
import { ExploreState, ExploreUrlState, HistoryItem, QueryTransaction } from 'app/types/explore';
import { DataQuery, RawTimeRange } from 'app/types/series';

import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';
import kbn from 'app/core/utils/kbn';
import colors from 'app/core/utils/colors';
import TimeSeries from 'app/core/time_series2';
import { parse as parseDate } from 'app/core/utils/datemath';
import store from 'app/core/store';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

const MAX_HISTORY_ITEMS = 100;

/**
 * Returns an Explore-URL that contains a panel's queries and the dashboard time range.
 *
 * @param panel Origin panel of the jump to Explore
 * @param panelTargets The origin panel's query targets
 * @param panelDatasource The origin panel's datasource
 * @param datasourceSrv Datasource service to query other datasources in case the panel datasource is mixed
 * @param timeSrv Time service to get the current dashboard range from
 */
export async function getExploreUrl(
  panel: any,
  panelTargets: any[],
  panelDatasource: any,
  datasourceSrv: any,
  timeSrv: any
) {
  let exploreDatasource = panelDatasource;
  let exploreTargets: DataQuery[] = panelTargets;
  let url;

  // Mixed datasources need to choose only one datasource
  if (panelDatasource.meta.id === 'mixed' && panelTargets) {
    // Find first explore datasource among targets
    let mixedExploreDatasource;
    for (const t of panel.targets) {
      const datasource = await datasourceSrv.get(t.datasource);
      if (datasource && datasource.meta.explore) {
        mixedExploreDatasource = datasource;
        break;
      }
    }

    // Add all its targets
    if (mixedExploreDatasource) {
      exploreDatasource = mixedExploreDatasource;
      exploreTargets = panelTargets.filter(t => t.datasource === mixedExploreDatasource.name);
    }
  }

  if (exploreDatasource && exploreDatasource.meta.explore) {
    const range = timeSrv.timeRangeForUrl();
    const state = {
      ...exploreDatasource.getExploreState(exploreTargets),
      range,
    };
    const exploreState = JSON.stringify(state);
    url = renderUrl('/explore', { state: exploreState });
  }
  return url;
}

const clearQueryKeys: ((query: DataQuery) => object) = ({ key, refId, ...rest }) => rest;

export function parseUrlState(initial: string | undefined): ExploreUrlState {
  if (initial) {
    try {
      const parsed = JSON.parse(decodeURI(initial));
      if (Array.isArray(parsed)) {
        if (parsed.length <= 3) {
          throw new Error('Error parsing compact URL state for Explore.');
        }
        const range = {
          from: parsed[0],
          to: parsed[1],
        };
        const datasource = parsed[2];
        const queries = parsed.slice(3);
        return { datasource, queries, range };
      }
      return parsed;
    } catch (e) {
      console.error(e);
    }
  }
  return { datasource: null, queries: [], range: DEFAULT_RANGE };
}

export function serializeStateToUrlParam(state: ExploreState, compact?: boolean): string {
  const urlState: ExploreUrlState = {
    datasource: state.datasourceName,
    queries: state.initialQueries.map(clearQueryKeys),
    range: state.range,
  };
  if (compact) {
    return JSON.stringify([urlState.range.from, urlState.range.to, urlState.datasource, ...urlState.queries]);
  }
  return JSON.stringify(urlState);
}

export function generateKey(index = 0): string {
  return `Q-${Date.now()}-${Math.random()}-${index}`;
}

export function generateRefId(index = 0): string {
  return `${index + 1}`;
}

export function generateQueryKeys(index = 0): { refId: string; key: string } {
  return { refId: generateRefId(index), key: generateKey(index) };
}

/**
 * Ensure at least one target exists and that targets have the necessary keys
 */
export function ensureQueries(queries?: DataQuery[]): DataQuery[] {
  if (queries && typeof queries === 'object' && queries.length > 0) {
    return queries.map((query, i) => ({ ...query, ...generateQueryKeys(i) }));
  }
  return [{ ...generateQueryKeys() }];
}

/**
 * A target is non-empty when it has keys other than refId and key.
 */
export function hasNonEmptyQuery(queries: DataQuery[]): boolean {
  return queries.some(
    query =>
      Object.keys(query)
        .map(k => query[k])
        .filter(v => v).length > 2
  );
}

export function calculateResultsFromQueryTransactions(
  queryTransactions: QueryTransaction[],
  datasource: any,
  graphInterval: number
) {
  const graphResult = _.flatten(
    queryTransactions.filter(qt => qt.resultType === 'Graph' && qt.done && qt.result).map(qt => qt.result)
  );
  const tableResult = mergeTablesIntoModel(
    new TableModel(),
    ...queryTransactions.filter(qt => qt.resultType === 'Table' && qt.done && qt.result).map(qt => qt.result)
  );
  const logsResult =
    datasource && datasource.mergeStreams
      ? datasource.mergeStreams(
          _.flatten(
            queryTransactions.filter(qt => qt.resultType === 'Logs' && qt.done && qt.result).map(qt => qt.result)
          ),
          graphInterval
        )
      : undefined;

  return {
    graphResult,
    tableResult,
    logsResult,
  };
}

export function getIntervals(
  range: RawTimeRange,
  datasource,
  resolution: number
): { interval: string; intervalMs: number } {
  if (!datasource || !resolution) {
    return { interval: '1s', intervalMs: 1000 };
  }
  const absoluteRange: RawTimeRange = {
    from: parseDate(range.from, false),
    to: parseDate(range.to, true),
  };
  return kbn.calculateInterval(absoluteRange, resolution, datasource.interval);
}

export function makeTimeSeriesList(dataList) {
  return dataList.map((seriesData, index) => {
    const datapoints = seriesData.datapoints || [];
    const alias = seriesData.target;
    const colorIndex = index % colors.length;
    const color = colors[colorIndex];

    const series = new TimeSeries({
      datapoints,
      alias,
      color,
      unit: seriesData.unit,
    });

    return series;
  });
}

/**
 * Update the query history. Side-effect: store history in local storage
 */
export function updateHistory(history: HistoryItem[], datasourceId: string, queries: DataQuery[]): HistoryItem[] {
  const ts = Date.now();
  queries.forEach(query => {
    history = [{ query, ts }, ...history];
  });

  if (history.length > MAX_HISTORY_ITEMS) {
    history = history.slice(0, MAX_HISTORY_ITEMS);
  }

  // Combine all queries of a datasource type into one history
  const historyKey = `grafana.explore.history.${datasourceId}`;
  store.setObject(historyKey, history);
  return history;
}

export function clearHistory(datasourceId: string) {
  const historyKey = `grafana.explore.history.${datasourceId}`;
  store.delete(historyKey);
}
