import { t } from '@grafana/i18n';
import { Box, EmptyState, Stack } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RuleSearchInput } from '../rule-search/RuleSearchInput';
import { useRuleListSearchState } from '../rule-search/useRuleListSearchState';
import { useTrackRuleListPageView } from '../shared/analytics';

import { AlertRulesListView } from './AlertRulesListView';
import { useAlertRuleSearchRejection } from './alertRuleSearch';

function AlertRulesPage() {
  const { query, filter, parseIssues, filters, applyQuery } = useRuleListSearchState('alert');
  const rejectionIssues = useAlertRuleSearchRejection(filter, { skip: parseIssues.length > 0 });
  const issues = parseIssues.length > 0 ? parseIssues : rejectionIssues;

  useTrackRuleListPageView('alert', 'list');

  return (
    // The heading comes from the navId, so it also drives breadcrumbs and nav highlighting.
    <AlertingPageWrapper navId="alert-rules">
      <Box paddingTop={2}>
        <Stack direction="column" gap={2}>
          <RuleSearchInput query={query} onApply={applyQuery} filters={filters} issues={issues} />
          {issues.length > 0 ? (
            <EmptyState
              variant="not-found"
              message={t('alerting.gma-rule-list.alert-rules.search-issues', 'Change the search to see results')}
            />
          ) : (
            <AlertRulesListView filter={filter} />
          )}
        </Stack>
      </Box>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(AlertRulesPage);
