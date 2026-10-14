import { t } from '@grafana/i18n';

import { withPageErrorBoundary } from '../../../withPageErrorBoundary';
import { RulesPageShell } from '../../page-shell/RulesPageShell';

import { RecordingRulesRecentlyDeleted } from './RecordingRulesRecentlyDeleted';

function RecordingRulesDeletedPage() {
  return (
    <RulesPageShell
      navId="recording-rules"
      pageLabel={t('alerting.gma-rule-list.recording-rules.title', 'Recording rules')}
      activeTab="deleted"
      activeHref="/alerting/rules/recording"
      deletedHref="/alerting/rules/recording/deleted"
    >
      <RecordingRulesRecentlyDeleted />
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(RecordingRulesDeletedPage);
