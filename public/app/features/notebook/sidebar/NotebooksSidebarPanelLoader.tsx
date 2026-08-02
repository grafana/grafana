import { Suspense, lazy } from 'react';

import PageLoader from 'app/core/components/PageLoader/PageLoader';

// This wrapper is imported in the plugin extension registry bootstrap path, so it must
// stay dependency-free: the actual panel (and the notebook feature it pulls in) is only
// loaded when the sidebar component is opened.
const NotebooksSidebarPanel = lazy(() => import('./NotebooksSidebarPanel'));

export function NotebooksSidebarPanelLoader() {
  return (
    <Suspense fallback={<PageLoader />}>
      <NotebooksSidebarPanel />
    </Suspense>
  );
}
