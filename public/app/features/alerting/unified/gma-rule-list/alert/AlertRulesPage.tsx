import { Trans, t } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RulesPagePlaceholder } from '../shared/RulesPagePlaceholder';
import { RulesPageShell } from '../shared/RulesPageShell';

function AlertRulesPage() {
  const canCreate = contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate);

  return (
    <RulesPageShell
      navId="alert-rules"
      title={t('alerting.gma-rule-list.alert-rules.title', 'Alert rules')}
      activeTab="active"
      activeHref="/alerting/rules/alert"
      deletedHref="/alerting/rules/alert/deleted"
      primaryAction={
        canCreate ? (
          <LinkButton href="/alerting/new/alerting" icon="plus" variant="primary">
            <Trans i18nKey="alerting.gma-rule-list.alert-rules.new-alert-rule">New alert rule</Trans>
          </LinkButton>
        ) : undefined
      }
    >
      <RulesPagePlaceholder />
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(AlertRulesPage);
