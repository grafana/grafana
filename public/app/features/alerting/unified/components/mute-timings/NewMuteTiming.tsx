import { t } from '@grafana/i18n';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';

import MuteTimingForm from './MuteTimingForm';

function NewMuteTimingPage() {
  return (
    <AlertmanagerPageWrapper
      navId="am-routes"
      pageNav={{
        id: 'alert-policy-new',
        text: t('alerting.new-mute-timing-page.text.add-time-interval', 'Add time interval'),
      }}
      accessType="notification"
    >
      <MuteTimingForm />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NewMuteTimingPage);
