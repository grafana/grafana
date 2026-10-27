import { Box } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { useTrackRuleListPageView } from '../shared/analytics';

import { AlertRulesListView } from './AlertRulesListView';

function AlertRulesPage() {
  useTrackRuleListPageView('alert', 'list');

  return (
    // The heading comes from the navId, so it also drives breadcrumbs and nav highlighting.
    <AlertingPageWrapper navId="alert-rules">
      <Box paddingTop={2}>
        <AlertRulesListView />
      </Box>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(AlertRulesPage);
