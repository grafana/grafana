import { Suspense, lazy } from 'react';

import PageLoader from 'app/core/components/PageLoader/PageLoader';

// The sidebar lives in the entry chunk; keep the notebook scene out of it.
const NotebooksSidePanelImpl = lazy(() =>
  import(/* webpackChunkName: "NotebooksSidePanel" */ './NotebooksSidePanel').then((module) => ({
    default: module.NotebooksSidePanel,
  }))
);

export function NotebooksSidePanel(props: { onClose: () => void }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <NotebooksSidePanelImpl {...props} />
    </Suspense>
  );
}
