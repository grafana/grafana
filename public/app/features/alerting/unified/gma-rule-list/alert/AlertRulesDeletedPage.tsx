import { t } from '@grafana/i18n';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertRulesRecentlyDeleted } from '../deleted/AlertRulesRecentlyDeleted';
import { RulesPageShell } from '../shared/RulesPageShell';

function AlertRulesDeletedPage() {
  return (
    <RulesPageShell
      navId="alert-rules"
      pageLabel={t('alerting.gma-rule-list.alert-rules.title', 'Alert rules')}
      activeTab="deleted"
      activeHref="/alerting/rules/alert"
      deletedHref="/alerting/rules/alert/deleted"
    >
      <AlertRulesRecentlyDeleted />
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(AlertRulesDeletedPage);
