import { type VizPanel } from '@grafana/scenes';

import { getQueryRunnerFor } from './getQueryRunnerFor';
import { isDefaultQuery, setQueryRunnerQueries } from './queryRunnerState';

/** Clear only the untouched default query when selecting a visualization that does not need it. */
export function clearDefaultQuery(panel: VizPanel) {
  const runner = getQueryRunnerFor(panel);
  if (!runner) {
    return;
  }

  const queries = runner.state.queries;
  if (queries.length === 1 && isDefaultQuery(queries[0])) {
    setQueryRunnerQueries(runner, []);
  }
}
