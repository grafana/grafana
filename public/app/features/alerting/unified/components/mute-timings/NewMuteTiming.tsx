import { withErrorBoundary } from '@grafana/ui';

import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';

import MuteTimingForm from './MuteTimingForm';

const NewMuteTimingPage = () => (
  <AlertmanagerPageWrapper
    navId="am-routes"
    pageNav={{
      id: 'alert-policy-new',
      text: 'Add mute timing',
    }}
    accessType="notification"
  >
    <MuteTimingForm />
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(NewMuteTimingPage, { style: 'page' });
