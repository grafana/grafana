import { lazy, Suspense } from 'react';

import { ErrorBoundary } from '@grafana/ui';

import { type ReviewPaneProps } from './ReviewPane';
import { ReviewTab } from './ReviewTab';

// The summary engine is loaded only once someone opens Review
const ReviewPane = lazy(() =>
  import(/* webpackChunkName: "dashboard-review" */ './ReviewPane').then((module) => ({ default: module.ReviewPane }))
);

/**
 * The Review tab's content, isolated from the drawer: a failure to load or render it shows the summary
 * failure, with its way to Changes, and never takes the save flow down with it.
 */
export function LazyReviewPane(props: ReviewPaneProps) {
  const { onBackToDetails, onShowChanges } = props;

  return (
    <ErrorBoundary boundaryName="dashboard-review">
      {({ error }) =>
        error ? (
          <ReviewTab state={{ status: 'error' }} onBackToDetails={onBackToDetails} onShowChanges={onShowChanges} />
        ) : (
          <Suspense
            fallback={
              <ReviewTab
                state={{ status: 'loading' }}
                onBackToDetails={onBackToDetails}
                onShowChanges={onShowChanges}
              />
            }
          >
            <ReviewPane {...props} />
          </Suspense>
        )
      }
    </ErrorBoundary>
  );
}
