import { useTimeIntervalsNav } from '../../navigation/useNotificationConfigNav';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from '../GrafanaAlertmanagerWarning';

import { TimeIntervalsTable } from './MuteTimingsTable';

function TimeIntervalsPage() {
  const { navId, pageNav } = useTimeIntervalsNav();

  return (
    <AlertmanagerPageWrapper navId={navId} pageNav={pageNav} accessType="notification">
      <GrafanaAlertmanagerWarning currentAlertmanager="grafana" />
      <TimeIntervalsTable />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(TimeIntervalsPage);
