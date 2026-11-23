import { Suspense, lazy, useState } from 'react';

import { locationService } from '@grafana/runtime';

import { COMMIT_OUTCOME_PARAM } from '../../constants';

const CommitOutcomeDrawer = lazy(() =>
  import('./SaveProvisionedResourceDrawer').then((module) => ({ default: module.CommitOutcomeDrawer }))
);

export function CommitOutcomeFromUrl() {
  const [param, setParam] = useState(() => locationService.getSearchObject()[COMMIT_OUTCOME_PARAM]);
  if (typeof param !== 'string') {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <CommitOutcomeDrawer param={param} onDismiss={() => setParam(undefined)} />
    </Suspense>
  );
}
