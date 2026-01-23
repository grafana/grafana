import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { useTimeIntervalsNav } from '../../navigation/useTimeIntervalsNav';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';

import MuteTimingForm from './MuteTimingForm';

function NewMuteTimingPage() {
  const { navId } = useTimeIntervalsNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  // For V2 nav, the parent URL points to the dedicated Time Intervals tab
  // For legacy nav, Time Intervals is accessed via the Notification Policies page
  const parentUrl = useV2Nav ? '/alerting/routes/mute-timing' : '/alerting/routes?tab=time_intervals';

  return (
    <AlertmanagerPageWrapper
      navId={navId}
      pageNav={{
        id: 'alert-policy-new',
        text: t('alerting.new-mute-timing-page.text.add-time-interval', 'Add time interval'),
        parentItem: {
          text: t('alerting.time-intervals.title', 'Time intervals'),
          url: parentUrl,
        },
      }}
      accessType="notification"
    >
      <MuteTimingForm />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NewMuteTimingPage);
