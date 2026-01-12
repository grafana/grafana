import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from './components/GrafanaAlertmanagerWarning';
import { TimeIntervalsTable } from './components/mute-timings/MuteTimingsTable';
import { useNotificationConfigNav } from './navigation/useNotificationConfigNav';
import { useAlertmanager } from './state/AlertmanagerContext';
import { withPageErrorBoundary } from './withPageErrorBoundary';

// Content component that uses AlertmanagerContext
// This must be rendered within AlertmanagerPageWrapper
function TimeIntervalsPageContent() {
  const { selectedAlertmanager } = useAlertmanager();

  return (
    <>
      <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager!} />
      <TimeIntervalsTable />
    </>
  );
}

function TimeIntervalsPage() {
  const { navId, pageNav } = useNotificationConfigNav();

  return (
    <AlertmanagerPageWrapper navId={navId || 'am-routes'} pageNav={pageNav} accessType="notification">
      <TimeIntervalsPageContent />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(TimeIntervalsPage);
