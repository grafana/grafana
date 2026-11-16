import { Navigate, useParams } from 'react-router-dom-v5-compat';

import { useGetMuteTiming } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';

import { EditMuteTimingPageLayout } from './EditMuteTiming';
import MuteTimingForm from './MuteTimingForm';

/** Edit page for a time interval addressed by its resource name (`metadata.name`) in the path */
const EditTimingRoute = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { name: id } = useParams();

  const {
    isLoading,
    data: timeInterval,
    isError,
  } = useGetMuteTiming({
    alertmanager: selectedAlertmanager!,
    id: id ?? '',
  });

  if (!id) {
    return <Navigate replace to="/alerting/routes/mute-timing" />;
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

function EditMuteTimingByPathPage() {
  return (
    <EditMuteTimingPageLayout>
      <EditTimingRoute />
    </EditMuteTimingPageLayout>
  );
}

export default withPageErrorBoundary(EditMuteTimingByPathPage);
