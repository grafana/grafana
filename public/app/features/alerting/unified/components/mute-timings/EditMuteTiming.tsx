import { Navigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useSearchMuteTiming } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { useURLSearchParams } from 'app/features/alerting/unified/hooks/useURLSearchParams';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';

import { useTimeIntervalsNav } from '../../navigation/useNotificationConfigNav';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { getTimeIntervalParentUrl } from '../../utils/navigation';
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
  } = useSearchMuteTiming({
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

export function EditMuteTimingPageLayout({ children }: { children: React.ReactNode }) {
  const { navId } = useTimeIntervalsNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;
  const parentUrl = getTimeIntervalParentUrl(useV2Nav);

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
      {children}
    </AlertmanagerPageWrapper>
  );
}

function EditMuteTimingPage() {
  return (
    <EditMuteTimingPageLayout>
      <EditTimingRoute />
    </EditMuteTimingPageLayout>
  );
}

export default withPageErrorBoundary(EditMuteTimingPage);
