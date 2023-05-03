import store from 'app/core/store';
import { ExploreGraphStyle, EXPLORE_GRAPH_STYLES } from 'app/types';

const GRAPH_STYLE_KEY = 'grafana.explore.style.graph';
export const storeGraphStyle = (graphStyle: string): void => {
  store.set(GRAPH_STYLE_KEY, graphStyle);
};

export const loadGraphStyle = (): ExploreGraphStyle => {
  return toGraphStyle(store.get(GRAPH_STYLE_KEY));
};

const DEFAULT_GRAPH_STYLE: ExploreGraphStyle = 'lines';
// we use this function to take any kind of data we loaded
// from an external source (URL, localStorage, whatever),
// and extract the graph-style from it, or return the default
// graph-style if we are not able to do that.
// it is important that this function is able to take any form of data,
// (be it objects, or arrays, or booleans or whatever),
// and produce a best-effort graphStyle.
// note that typescript makes sure we make no mistake in this function.
// we do not rely on ` as ` or ` any `.
export const toGraphStyle = (data: unknown): ExploreGraphStyle => {
  const found = EXPLORE_GRAPH_STYLES.find((v) => v === data);
  return found ?? DEFAULT_GRAPH_STYLE;
};
