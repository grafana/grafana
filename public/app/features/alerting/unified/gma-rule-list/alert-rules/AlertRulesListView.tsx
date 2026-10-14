import { useListAlertRuleSearchV0Alpha1Mutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Button, LoadingPlaceholder, Stack } from '@grafana/ui';

import { RuleRowList } from '../rule-row/RuleRowList';
import { type Criteria } from '../rule-search/criteria';
import { useContinuationSearch } from '../shared/useContinuationSearch';

import { AlertRuleActions } from './AlertRuleActions';
import { AlertRuleRow } from './AlertRuleRow';
import { toAlertRuleSearchHit } from './alertRuleSearchHit';
import { buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

interface ListViewProps {
  criteria: Criteria;
  /** Folded into useContinuationSearch's resetKey together with the criteria, so a plain
   * refresh (no criteria change) also restarts at page one. */
  resetKey: unknown;
}

/**
 * List mode: a single flat, title-sorted Alert-rule search with Load more. Every row shows
 * its folder path (alert-rules-page.md "List mode") - no folder-count requests happen here.
 */
export function ListView({ criteria, resetKey }: ListViewProps) {
  const [triggerRuleSearch] = useListAlertRuleSearchV0Alpha1Mutation();

  const fetchPage = async (continueToken: string | undefined) => {
    const result = await triggerRuleSearch({
      searchQuery: buildAlertRuleSearchQuery(criteria, { continue: continueToken }),
    }).unwrap();
    return {
      items: result.items.map(toAlertRuleSearchHit),
      continueToken: result.metadata.continue,
    };
  };

  const { rows, isLoading, error, loadMoreError, hasMore, loadMore, retry } = useContinuationSearch(
    fetchPage,
    JSON.stringify([criteria, resetKey])
  );

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.gma-rule-list.alert-rules.loading-rules', 'Loading rules...')} />;
  }

  if (error) {
    return <div role="alert">{t('alerting.gma-rule-list.alert-rules.rules-error', 'Failed to load rules')}</div>;
  }

  if (rows.length === 0) {
    return <div>{t('alerting.gma-rule-list.alert-rules.no-rules', 'No Alert rules found')}</div>;
  }

  return (
    <Stack direction="column" gap={0.5}>
      <RuleRowList>
        {rows.map((hit) => (
          <AlertRuleRow key={hit.uid} hit={hit} showFolderPath actions={<AlertRuleActions ruleUid={hit.uid} />} />
        ))}
      </RuleRowList>
      {Boolean(loadMoreError) && (
        <Stack direction="row" gap={1} alignItems="center">
          <div role="alert">{t('alerting.gma-rule-list.alert-rules.load-more-error', 'Failed to load more rules')}</div>
          <Button size="sm" variant="secondary" onClick={retry}>
            {t('alerting.gma-rule-list.alert-rules.retry', 'Retry')}
          </Button>
        </Stack>
      )}
      {hasMore && !loadMoreError && (
        <Button size="sm" variant="secondary" onClick={loadMore}>
          {t('alerting.gma-rule-list.alert-rules.load-more', 'Load more')}
        </Button>
      )}
    </Stack>
  );
}
