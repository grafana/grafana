import { lazy, Suspense } from 'react';

import PageLoader from 'app/core/components/PageLoader/PageLoader';

const NotebookCaptureSidebar = lazy(() => import('./NotebookCaptureSidebar'));

export function NotebookCaptureSidebarLazy() {
  return (
    <Suspense fallback={<PageLoader />}>
      <NotebookCaptureSidebar />
    </Suspense>
  );
}
