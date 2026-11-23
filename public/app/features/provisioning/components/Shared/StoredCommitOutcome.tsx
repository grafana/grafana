import { Suspense, lazy, useState } from 'react';

import { COMMIT_OUTCOME_STORAGE_KEY } from '../../constants';

const CommitOutcomeDrawer = lazy(() =>
  import('./SaveProvisionedResourceDrawer').then((module) => ({ default: module.CommitOutcomeDrawer }))
);

function readStored() {
  try {
    return window.sessionStorage.getItem(COMMIT_OUTCOME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function StoredCommitOutcome() {
  const [stored, setStored] = useState(readStored);
  if (!stored) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <CommitOutcomeDrawer stored={stored} onDismiss={() => setStored(null)} />
    </Suspense>
  );
}
