import { Suspense, lazy } from 'react';

import { type PullRequestBannerProps } from '@grafana/runtime';

const SuspendingPreviewBannerViewPR = lazy(() =>
  import('./PreviewBannerViewPR').then((module) => ({ default: module.PreviewBannerViewPR }))
);

export const LazyPullRequestBanner = (props: PullRequestBannerProps) => {
  return (
    <Suspense fallback={null}>
      <SuspendingPreviewBannerViewPR {...props} />
    </Suspense>
  );
};
