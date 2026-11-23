import { Suspense, lazy, useState } from 'react';

import { COMMIT_OUTCOME_STORAGE_KEY } from '../../constants';

const CommitOutcomeDrawer = lazy(() =>
  import('./SaveProvisionedResourceDrawer').then((module) => ({ default: module.CommitOutcomeDrawer }))
);

export function StoredCommitOutcome() {
  const [stored, setStored] = useState(() => window.sessionStorage.getItem(COMMIT_OUTCOME_STORAGE_KEY));
  if (!stored) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <CommitOutcomeDrawer stored={stored} onDismiss={() => setStored(null)} />
    </Suspense>
  );
}
