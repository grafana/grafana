import { Navigate } from 'react-router-dom-v5-compat';

import { withErrorBoundary } from '@grafana/ui';
import { useGetMuteTiming } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { useURLSearchParams } from 'app/features/alerting/unified/hooks/useURLSearchParams';

import { useAlertmanager } from '../../state/AlertmanagerContext';
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

  return (
    <MuteTimingForm
      editMode
      loading={isLoading}
      showError={isError}
      muteTiming={timeInterval}
      provisioned={timeInterval?.provisioned}
    />
  );
};

const EditMuteTimingPage = () => (
  <AlertmanagerPageWrapper
    navId="am-routes"
    pageNav={{
      id: 'alert-policy-edit',
      text: 'Edit mute timing',
    }}
    accessType="notification"
  >
    <EditTimingRoute />
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(EditMuteTimingPage, { style: 'page' });
