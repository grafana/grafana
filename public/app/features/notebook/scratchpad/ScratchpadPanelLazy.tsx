import { Suspense, lazy } from 'react';

import PageLoader from 'app/core/components/PageLoader/PageLoader';

// The sidebar lives in the entry chunk; keep the dnd library out of it.
const ScratchpadPanelImpl = lazy(() =>
  import(/* webpackChunkName: "ScratchpadPanel" */ './ScratchpadPanel').then((module) => ({
    default: module.ScratchpadPanel,
  }))
);

export function ScratchpadPanel(props: { onClose: () => void }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <ScratchpadPanelImpl {...props} />
    </Suspense>
  );
}
