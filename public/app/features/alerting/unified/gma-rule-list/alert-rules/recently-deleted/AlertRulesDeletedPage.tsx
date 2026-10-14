import { t } from '@grafana/i18n';

import { withPageErrorBoundary } from '../../../withPageErrorBoundary';
import { RulesPageShell } from '../../page-shell/RulesPageShell';

import { AlertRulesRecentlyDeleted } from './AlertRulesRecentlyDeleted';

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
