import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from './components/GrafanaAlertmanagerWarning';
import { TimeIntervalsTable } from './components/mute-timings/MuteTimingsTable';
import { shouldUseAlertingNavigationV2 } from './featureToggles';
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
  const useV2Nav = shouldUseAlertingNavigationV2();
  const { navId, pageNav } = useNotificationConfigNav();

  // In V2 mode, wrap with page wrapper for proper navigation
  // AlertmanagerPageWrapper provides AlertmanagerContext, so TimeIntervalsPageContent can use useAlertmanager
  if (useV2Nav) {
    return (
      <AlertmanagerPageWrapper navId={navId || 'am-routes'} pageNav={pageNav} accessType="notification">
        <TimeIntervalsPageContent />
      </AlertmanagerPageWrapper>
    );
  }

  // Legacy mode: not used (handled by NotificationPoliciesPage)
  return null;
}

export default withPageErrorBoundary(TimeIntervalsPage);
