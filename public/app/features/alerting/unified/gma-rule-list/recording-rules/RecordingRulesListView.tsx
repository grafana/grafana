import { t } from '@grafana/i18n';
import { Button, LoadingPlaceholder, Stack } from '@grafana/ui';

import { RuleRowList } from '../rule-row/RuleRowList';
import { type Criteria } from '../rule-search/criteria';
import { useContinuationSearch } from '../shared/useContinuationSearch';

import { RecordingRuleActions } from './RecordingRuleActions';
import { RecordingRuleRow } from './RecordingRuleRow';
import { useRecordingRuleSearch } from './recordingRuleSearch';

interface ListViewProps {
  criteria: Criteria;
  resetKey: unknown;
}

/**
 * List mode: a single flat, title-sorted Recording-rule search with Load more. Every row shows
 * its folder path - no folder-count requests happen here.
 */
export function ListView({ criteria, resetKey }: ListViewProps) {
  const searchRules = useRecordingRuleSearch();

  const fetchPage = async (continueToken: string | undefined) => {
    const page = await searchRules(criteria, { continueToken });
    return { items: page.hits, continueToken: page.continueToken };
  };

  const { rows, isLoading, error, loadMoreError, hasMore, loadMore, retry } = useContinuationSearch(
    fetchPage,
    JSON.stringify([criteria, resetKey])
  );

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.gma-rule-list.recording-rules.loading-rules', 'Loading rules...')} />;
  }

  if (error) {
    return <div role="alert">{t('alerting.gma-rule-list.recording-rules.rules-error', 'Failed to load rules')}</div>;
  }

  if (rows.length === 0) {
    return <div>{t('alerting.gma-rule-list.recording-rules.no-rules', 'No Recording rules found')}</div>;
  }

  return (
    <Stack direction="column" gap={0.5}>
      <RuleRowList>
        {rows.map((hit) => (
          <RecordingRuleRow
            key={hit.uid}
            hit={hit}
            showFolderPath
            actions={<RecordingRuleActions ruleUid={hit.uid} />}
          />
        ))}
      </RuleRowList>
      {Boolean(loadMoreError) && (
        <Stack direction="row" gap={1} alignItems="center">
          <div role="alert">
            {t('alerting.gma-rule-list.recording-rules.load-more-error', 'Failed to load more rules')}
          </div>
          <Button size="sm" variant="secondary" onClick={retry}>
            {t('alerting.gma-rule-list.recording-rules.retry', 'Retry')}
          </Button>
        </Stack>
      )}
      {hasMore && !loadMoreError && (
        <Button size="sm" variant="secondary" onClick={loadMore}>
          {t('alerting.gma-rule-list.recording-rules.load-more', 'Load more')}
        </Button>
      )}
    </Stack>
  );
}
