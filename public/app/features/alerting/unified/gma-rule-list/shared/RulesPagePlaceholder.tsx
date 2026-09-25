import { t } from '@grafana/i18n';
import { EmptyState } from '@grafana/ui';

/**
 * Temporary body for the GMA-only rule list pages while browsing (L1/L2/R2), search (S4), and
 * rows/actions (R1/A1) are still being built in later waves.
 */
export function RulesPagePlaceholder() {
  return (
    <EmptyState
      variant="not-found"
      message={t('alerting.gma-rule-list.placeholder-message', 'This page is under construction')}
    />
  );
}
