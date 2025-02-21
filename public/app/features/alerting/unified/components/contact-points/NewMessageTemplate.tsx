import { useAlertmanager } from '../../state/AlertmanagerContext';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { TemplateForm } from '../receivers/TemplateForm';

function NewMessageTemplate() {
  const { selectedAlertmanager } = useAlertmanager();

  return (
    <AlertmanagerPageWrapper navId="receivers" accessType="notification">
      <TemplateForm alertmanager={selectedAlertmanager ?? ''} />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NewMessageTemplate);
