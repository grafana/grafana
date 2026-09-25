import { t } from '@grafana/i18n';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RulesPagePlaceholder } from '../shared/RulesPagePlaceholder';
import { RulesPageShell } from '../shared/RulesPageShell';

function RecordingRulesDeletedPage() {
  return (
    <RulesPageShell
      navId="recording-rules"
      title={t('alerting.gma-rule-list.recording-rules.title', 'Recording rules')}
      activeTab="deleted"
      activeHref="/alerting/rules/recording"
      deletedHref="/alerting/rules/recording/deleted"
    >
      <RulesPagePlaceholder />
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(RecordingRulesDeletedPage);
