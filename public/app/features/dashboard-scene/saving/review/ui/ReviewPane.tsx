import { ReviewTab } from './ReviewTab';
import { type UseReviewSummaryOptions, useReviewSummary } from './useReviewSummary';

export interface ReviewPaneProps extends UseReviewSummaryOptions {
  onBackToDetails: () => void;
  onShowChanges: () => void;
}

/** The Review tab's content. The drawer mounts it only while Review is open, so the summary is computed only then. */
export function ReviewPane({ onBackToDetails, onShowChanges, ...options }: ReviewPaneProps) {
  const state = useReviewSummary(options);

  return <ReviewTab state={state} onBackToDetails={onBackToDetails} onShowChanges={onShowChanges} />;
}
