import { Navigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useGetMuteTiming } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { useURLSearchParams } from 'app/features/alerting/unified/hooks/useURLSearchParams';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';

import { useTimeIntervalsNav } from '../../navigation/useTimeIntervalsNav';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';

import MuteTimingForm from './MuteTimingForm';

const EditTimingRoute = () => {
  const [queryParams] = useURLSearchParams();
  const { selectedAlertmanager } = useAlertmanager();
  const name = queryParams.get('muteName')!;

  const {
    isLoading,
    data: timeInterval,
    isError,
  } = useGetMuteTiming({
    alertmanager: selectedAlertmanager!,
    name,
  });

  if (!name) {
    return <Navigate replace to="/alerting/routes" />;
  }

  const provenance = timeInterval?.metadata?.annotations?.[K8sAnnotations.Provenance];

  return (
    <MuteTimingForm
      editMode
      loading={isLoading}
      showError={isError}
      muteTiming={timeInterval}
      provenance={provenance}
    />
  );
};

function EditMuteTimingPage() {
  const { navId } = useTimeIntervalsNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  // For V2 nav, the parent URL points to the dedicated Time Intervals tab
  // For legacy nav, Time Intervals is accessed via the Notification Policies page
  const parentUrl = useV2Nav ? '/alerting/routes/mute-timing' : '/alerting/routes?tab=time_intervals';

  return (
    <AlertmanagerPageWrapper
      navId={navId}
      pageNav={{
        id: 'alert-policy-edit',
        text: t('alerting.edit-mute-timing-page.text.edit-time-interval', 'Edit time interval'),
        parentItem: {
          text: t('alerting.time-intervals.title', 'Time intervals'),
          url: parentUrl,
        },
      }}
      accessType="notification"
    >
      <EditTimingRoute />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(EditMuteTimingPage);
