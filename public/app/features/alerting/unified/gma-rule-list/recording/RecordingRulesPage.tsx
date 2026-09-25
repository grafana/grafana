import { Trans, t } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RulesPagePlaceholder } from '../shared/RulesPagePlaceholder';
import { RulesPageShell } from '../shared/RulesPageShell';

function RecordingRulesPage() {
  const canCreate = contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate);

  return (
    <RulesPageShell
      navId="recording-rules"
      title={t('alerting.gma-rule-list.recording-rules.title', 'Recording rules')}
      activeTab="active"
      activeHref="/alerting/rules/recording"
      deletedHref="/alerting/rules/recording/deleted"
      primaryAction={
        canCreate ? (
          <LinkButton href="/alerting/new/grafana-recording" icon="plus" variant="primary">
            <Trans i18nKey="alerting.gma-rule-list.recording-rules.new-recording-rule">New recording rule</Trans>
          </LinkButton>
        ) : undefined
      }
    >
      <RulesPagePlaceholder />
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(RecordingRulesPage);
