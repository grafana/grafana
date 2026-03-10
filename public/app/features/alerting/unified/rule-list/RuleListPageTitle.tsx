import { useState } from 'react';

import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Button, ButtonProps, Stack } from '@grafana/ui';

import {
  ViewExperienceToggleEventPayload,
  trackViewExperienceToggleClick,
  trackViewExperienceToggleConfirmed,
} from '../Analytics';
import { shouldUseAlertingListViewV2 } from '../featureToggles';
import { setPreviewToggle } from '../previewToggles';
import { ALERTING_PATHS } from '../utils/navigation';

import { RevertToOldExperienceModal } from './AlertsActivityOptOutModal';

export function RuleListPageTitle({ title }: { title: string }) {
  const shouldShowV2Toggle = config.featureToggles.alertingListViewV2PreviewToggle ?? false;
  const listViewV2Enabled = shouldUseAlertingListViewV2();

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const getEventPayload = (): ViewExperienceToggleEventPayload => ({
    currentView: listViewV2Enabled ? 'v2' : 'v1',
    targetView: listViewV2Enabled ? 'v1' : 'v2',
  });

  const handleToggleClick = () => {
    trackViewExperienceToggleClick({
      ...getEventPayload(),
      action: 'clicked',
    });

    // Only show confirmation when switching from NEW to OLD
    // When switching from OLD to NEW, just do it directly
    if (listViewV2Enabled) {
      setShowConfirmModal(true);
    } else {
      // Switching to new experience - no confirmation needed
      switchToNewExperience();
    }
  };

  const switchToNewExperience = () => {
    try {
      setPreviewToggle('alertingListViewV2', true);
      trackViewExperienceToggleConfirmed({
        ...getEventPayload(),
        preferenceSaved: true,
      });
      window.location.reload();
    } catch {
      // preferenceSaved: false when localStorage write fails (e.g., private browsing, storage full)
      trackViewExperienceToggleConfirmed({
        ...getEventPayload(),
        preferenceSaved: false,
      });
    }
  };

  const handleRevert = () => {
    trackViewExperienceToggleClick({
      ...getEventPayload(),
      action: 'confirmed',
    });
    setShowConfirmModal(false);

    try {
      setPreviewToggle('alertingListViewV2', false);
      trackViewExperienceToggleConfirmed({
        ...getEventPayload(),
        preferenceSaved: true,
      });
      window.location.reload();
    } catch {
      trackViewExperienceToggleConfirmed({
        ...getEventPayload(),
        preferenceSaved: false,
      });
    }
  };

  const handleSeeAlertActivity = () => {
    trackViewExperienceToggleClick({
      ...getEventPayload(),
      action: 'canceled',
    });
    setShowConfirmModal(false);
    // Navigate to Alert Activity page (locationService auto-prefixes, no createRelativeUrl needed)
    locationService.push(ALERTING_PATHS.ALERTS_ACTIVITY);
  };

  const handleDismiss = () => {
    trackViewExperienceToggleClick({
      ...getEventPayload(),
      action: 'canceled',
    });
    setShowConfirmModal(false);
  };

  // Button configuration based on current view
  const configToUse: ButtonProps & { 'data-testid': string } = listViewV2Enabled
    ? {
        variant: 'secondary',
        icon: undefined,
        children: t('alerting.rule-list.toggle.view-previous-experience', 'Revert to previous experience'),
        'data-testid': 'alerting-list-view-toggle-v1',
      }
    : {
        variant: 'primary',
        icon: 'rocket',
        children: t('alerting.rule-list.toggle.use-new-experience', 'Use new experience'),
        'data-testid': 'alerting-list-view-toggle-v2',
      };

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <h1>{title}</h1>
        {shouldShowV2Toggle && (
          <div>
            <Button size="sm" fill="outline" {...configToUse} onClick={handleToggleClick} className="fs-unmask" />
          </div>
        )}
      </Stack>

      <RevertToOldExperienceModal
        isOpen={showConfirmModal}
        onRevert={handleRevert}
        onSeeAlertActivity={handleSeeAlertActivity}
        onDismiss={handleDismiss}
      />
    </>
  );
}
