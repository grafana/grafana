import { Trans } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { AlertingAction, useAlertingAbility } from '../hooks/useAbilities';
import { useAlertRulesNav } from '../navigation/useAlertRulesNav';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { RecordingRulesTab } from './tabs/RecordingRulesTab';

function RecordingRulesPage() {
  const { navId, pageNav } = useAlertRulesNav();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav} actions={<RecordingRulesActions />}>
      <RecordingRulesTab />
    </AlertingPageWrapper>
  );
}

function RecordingRulesActions() {
  const [canCreate, canCreateAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  if (!canCreate || !canCreateAllowed) {
    return null;
  }
  return (
    <LinkButton variant="primary" icon="plus" href="/alerting/new/grafana-recording">
      <Trans i18nKey="alerting.rule-list.new-recording-rule">New recording rule</Trans>
    </LinkButton>
  );
}

export default withPageErrorBoundary(RecordingRulesPage);
