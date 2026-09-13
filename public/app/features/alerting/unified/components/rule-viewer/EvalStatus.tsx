import { useMeasure } from 'react-use';

import { Trans } from '@grafana/i18n';
import { LoadingBar, Text } from '@grafana/ui';

export function EvalLoadingBar() {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  return (
    <div ref={ref} data-testid="eval-loading-bar">
      <LoadingBar width={width} />
    </div>
  );
}

export function NoEvalData() {
  return (
    <Text color="secondary" variant="bodySmall">
      <Trans i18nKey="alerting.query-viewer.no-eval-data">No data — query results could not be loaded.</Trans>
    </Text>
  );
}

// Distinct from NoEvalData: the rule has no data source query to run at all (e.g. an
// expression-only rule), so there is nothing to evaluate — not a failed/empty load.
export function NoQueryToRun() {
  return (
    <Text color="secondary" variant="bodySmall">
      <Trans i18nKey="alerting.query-viewer.no-query">No data source query to run for this rule.</Trans>
    </Text>
  );
}
