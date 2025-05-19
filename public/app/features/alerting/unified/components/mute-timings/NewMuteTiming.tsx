import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';

import MuteTimingForm from './MuteTimingForm';

function NewMuteTimingPage() {
  return (
    <AlertmanagerPageWrapper
      navId="am-routes"
      pageNav={{ id: 'alert-policy-new', text: 'Add time interval' }}
      accessType="notification"
    >
      <MuteTimingForm />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NewMuteTimingPage);
