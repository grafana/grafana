import { RouteChildrenProps } from 'react-router-dom';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useGetContactPoint } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { EditReceiverView } from '../receivers/EditReceiverView';

type Props = RouteChildrenProps<{ name: string }>;

const EditContactPoint = ({ match }: Props) => {
  const { selectedAlertmanager } = useAlertmanager();

  const contactPointName = decodeURIComponent(match?.params.name!);
  const {
    isLoading,
    error,
    data: contactPoint,
  } = useGetContactPoint({ name: contactPointName, alertmanager: selectedAlertmanager! });

  if (isLoading) {
    return <LoadingPlaceholder text="Loading..." />;
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to fetch contact point">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!contactPoint) {
    return (
      <Alert severity="error" title="Receiver not found">
        {'Sorry, this contact point does not seem to exist.'}
      </Alert>
    );
  }

  return <EditReceiverView alertmanagerName={selectedAlertmanager!} contactPoint={contactPoint} />;
};

export default EditContactPoint;
