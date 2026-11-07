import { type VizPanel } from '@grafana/scenes';

import { getQueryRunnerFor } from './getQueryRunnerFor';

/** Only for initial visualization selection, before users start configuring queries. */
export function clearDefaultQuery(panel: VizPanel) {
  const runner = getQueryRunnerFor(panel);
  const queries = runner?.state.queries;
  if (queries?.length === 1 && queries[0].refId === 'A' && Object.keys(queries[0]).length === 1) {
    runner?.setState({ queries: [], _hasFetchedData: true });
  }
}
