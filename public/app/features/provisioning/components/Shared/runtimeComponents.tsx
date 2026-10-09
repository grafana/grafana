import { type ComponentType, lazy, Suspense } from 'react';

import { type provisioning } from '@grafana/runtime';

// Lazily loaded implementations of the `provisioning` components in @grafana/runtime. Wired up at
// application start with `provisioning.setComponents`, next to `setFolderPicker`.

function withSuspense<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): ComponentType<P> {
  const Lazy = lazy(load);
  return (props: P) => (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}

export const provisioningComponents: Parameters<typeof provisioning.setComponents>[0] = {
  SaveResourceDrawer: withSuspense(() =>
    import('./SaveResourceDrawer').then((m) => ({ default: m.SaveResourceDrawer }))
  ),
  ManagedBadge: withSuspense(() =>
    import('./ManagedBadgeForResource').then((m) => ({ default: m.ManagedBadgeForResource }))
  ),
  PullRequestBanner: withSuspense(() => import('./PullRequestBanner').then((m) => ({ default: m.PullRequestBanner }))),
  RepositorySelect: withSuspense(() =>
    import('./RepositorySelectForKind').then((m) => ({ default: m.RepositorySelectForKind }))
  ),
};
