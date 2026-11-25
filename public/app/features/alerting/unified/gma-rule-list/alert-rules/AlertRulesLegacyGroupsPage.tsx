import { useEffect } from 'react';

import { reportInteraction } from '@grafana/runtime';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { useAlertRulesNav } from '../../navigation/useAlertRulesNav';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { LegacyGroupsView } from '../legacy-groups/LegacyGroupsView';

function AlertRulesLegacyGroupsPage() {
  const { navId, pageNav } = useAlertRulesNav();

  useEffect(() => {
    reportInteraction('grafana_alerting_legacy_groups_view', { kind: 'alert' });
  }, []);

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav}>
      <LegacyGroupsView />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(AlertRulesLegacyGroupsPage);
