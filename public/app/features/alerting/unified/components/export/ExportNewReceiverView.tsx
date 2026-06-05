import { useContactPointsNav } from '../../navigation/useNotificationConfigNav';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { GrafanaExportReceiverForm } from '../receivers/form/GrafanaExportReceiverForm';

const ExportNewReceiverViewPage = () => {
  const { navId, pageNav } = useContactPointsNav();

  return (
    <AlertmanagerPageWrapper navId={navId} pageNav={pageNav} accessType="notification">
      <GrafanaExportReceiverForm />
    </AlertmanagerPageWrapper>
  );
};

export default withPageErrorBoundary(ExportNewReceiverViewPage);
