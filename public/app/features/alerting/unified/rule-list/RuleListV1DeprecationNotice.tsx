import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

import { trackViewExperienceToggleConfirmed } from '../Analytics';
import { isAlertingListViewV2Allowed } from '../featureToggles';
import { setPreviewToggle } from '../previewToggles';

export function RuleListV1DeprecationNotice() {
  // If the new list is turned on, being here means this person chose the old list themselves,
  // so give them a way back even when the "use new experience" button isn't offered.
  const canSwitchToNewList = isAlertingListViewV2Allowed();

  const switchToNewList = () => {
    try {
      setPreviewToggle('alertingListViewV2', true);
      trackViewExperienceToggleConfirmed({ currentView: 'v1', targetView: 'v2', preferenceSaved: true });
      window.location.reload();
    } catch {
      trackViewExperienceToggleConfirmed({ currentView: 'v1', targetView: 'v2', preferenceSaved: false });
    }
  };

  return (
    <Alert
      severity="warning"
      title={t('alerting.rule-list-v1.deprecation-notice.title', 'This version of the alert rule list is deprecated')}
    >
      <Stack direction="column" alignItems="flex-start" gap={1}>
        <Trans i18nKey="alerting.rule-list-v1.deprecation-notice.body">
          It will be removed in a future release of Grafana and replaced by the new alert rule list.
        </Trans>
        {canSwitchToNewList && (
          <Button size="sm" variant="secondary" icon="rocket" onClick={switchToNewList}>
            <Trans i18nKey="alerting.rule-list-v1.deprecation-notice.switch-button">Switch to the new list</Trans>
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
