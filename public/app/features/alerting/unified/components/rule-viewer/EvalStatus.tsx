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
      <Trans i18nKey="alerting.query-viewer.no-eval-data">No data — query results could not be loaded</Trans>
    </Text>
  );
}
