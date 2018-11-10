import { renderUrl } from 'app/core/utils/url';
import { ExploreState, ExploreUrlState } from 'app/types/explore';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

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
  let exploreTargets = panelTargets;
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
        const queries = parsed.slice(3).map(query => ({ query }));
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
    queries: state.queries.map(q => ({ query: q.query })),
    range: state.range,
  };
  if (compact) {
    return JSON.stringify([
      urlState.range.from,
      urlState.range.to,
      urlState.datasource,
      ...urlState.queries.map(q => q.query),
    ]);
  }
  return JSON.stringify(urlState);
}
