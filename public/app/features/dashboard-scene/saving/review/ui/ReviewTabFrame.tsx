import { type ReactNode } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Button, LoadingPlaceholder, ScrollContainer } from '@grafana/ui';

interface Props {
  loading?: boolean;
  /** Shows the summary failure, with its way to the Changes tab. */
  failed?: boolean;
  onBackToDetails: () => void;
  onShowChanges: () => void;
  children?: ReactNode;
}

/**
 * The Review tab's layout, loading and failure states. Kept apart from the summary view so the drawer can
 * show them while the review chunk loads, or after it fails, without bundling the review UI.
 */
export function ReviewTabFrame({ loading, failed, onBackToDetails, onShowChanges, children }: Props) {
  return (
    <Box display="flex" direction="column" height="100%">
      <ScrollContainer showScrollIndicators>
        <Box padding={0.5}>
          {loading && <LoadingPlaceholder text={t('dashboard-scene.review.loading', 'Summarizing changes…')} />}
          {failed && (
            <Alert severity="warning" title={t('dashboard-scene.review.error-title', 'Unable to summarize changes')}>
              <Button variant="primary" fill="text" size="sm" onClick={onShowChanges}>
                <Trans i18nKey="dashboard-scene.review.error-show-changes">See the technical diff in Changes</Trans>
              </Button>
            </Alert>
          )}
          {children}
        </Box>
      </ScrollContainer>
      <Box paddingTop={2}>
        <Button variant="secondary" icon="arrow-left" onClick={onBackToDetails}>
          <Trans i18nKey="dashboard-scene.review.back-to-details">Back to details</Trans>
        </Button>
      </Box>
    </Box>
  );
}
