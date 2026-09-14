import { lazy, Suspense } from 'react';

import { Spinner } from '@grafana/ui';

// Lazy so the dashboard-scene machinery loads only when a preview is actually shown.
const DashboardPreview = lazy(async () => {
  const { DashboardPreview } = await import('./DashboardPreview');
  return { default: DashboardPreview };
});

export function DashboardPreviewLazy({ uid }: { uid: string }) {
  return (
    <Suspense fallback={<Spinner />}>
      {/* Keyed by uid so moving between rows restarts the preview (and its loading delay). */}
      <DashboardPreview key={uid} uid={uid} />
    </Suspense>
  );
}
