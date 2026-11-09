import { type VizPanel } from '@grafana/scenes';

import { getQueryRunnerFor } from './getQueryRunnerFor';
import { getEmptyQueryRunnerState, isDefaultQuery } from './queryRunnerState';

/** Only for initial visualization selection, before users start configuring queries. */
export function clearDefaultQuery(panel: VizPanel) {
  const runner = getQueryRunnerFor(panel);
  const queries = runner?.state.queries;
  if (queries?.length === 1 && isDefaultQuery(queries[0])) {
    runner.cancelQuery();
    runner.setState({ ...getEmptyQueryRunnerState(), data: undefined });
  }
}
