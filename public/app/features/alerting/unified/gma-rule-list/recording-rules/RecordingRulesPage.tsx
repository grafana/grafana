import { Box } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { useTrackRuleListPageView } from '../shared/analytics';

import { RecordingRulesListView } from './RecordingRulesListView';

function RecordingRulesPage() {
  useTrackRuleListPageView('recording', 'list');

  return (
    // The heading comes from the navId, so it also drives breadcrumbs and nav highlighting.
    <AlertingPageWrapper navId="recording-rules">
      <Box paddingTop={2}>
        <RecordingRulesListView />
      </Box>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(RecordingRulesPage);
