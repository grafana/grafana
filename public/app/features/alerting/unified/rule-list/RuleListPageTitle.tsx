import { useCallback } from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { Button, ButtonProps, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { setLocalStorageFeatureToggle, shouldUseAlertingListViewV2 } from '../featureToggles';

export function RuleListPageTitle({ title }: { title: string }) {
  const shouldShowV2Toggle = config.featureToggles.alertingListViewV2PreviewToggle ?? false;

  const { listViewV2Enabled, enableListViewV2, disableListViewV2 } = useV2AlertListViewToggle();

  const toggleListView = () => {
    if (listViewV2Enabled) {
      disableListViewV2();
      reportInteraction('alerting.list_view.v2.disabled');
    } else {
      enableListViewV2();
      reportInteraction('alerting.list_view.v2.enabled');
    }
    window.location.reload();
  };

  const { text, ...configToUse }: ButtonProps & { text: string; 'data-testid': string } = listViewV2Enabled
    ? {
        variant: 'secondary',
        icon: undefined,
        text: t('alerting.rule-list.toggle.go-back-to-old-look', 'Go back to the old look'),
        'data-testid': 'alerting-list-view-toggle-v1',
      }
    : {
        variant: 'primary',
        icon: 'rocket',
        text: t('alerting.rule-list.toggle.try-out-the-new-look', 'Try out the new look!'),
        'data-testid': 'alerting-list-view-toggle-v2',
      };

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
      <h1>{title}</h1>
      {shouldShowV2Toggle && (
        <div>
          <Button size="sm" fill="outline" {...configToUse} onClick={toggleListView} className="fs-unmask">
            {text}
          </Button>
        </div>
      )}
    </Stack>
  );
}

function useV2AlertListViewToggle() {
  const listViewV2Enabled = shouldUseAlertingListViewV2();

  const enableListViewV2 = useCallback(() => {
    setLocalStorageFeatureToggle('alertingListViewV2', true);
  }, []);

  const disableListViewV2 = useCallback(() => {
    setLocalStorageFeatureToggle('alertingListViewV2', undefined);
  }, []);

  return {
    listViewV2Enabled,
    enableListViewV2,
    disableListViewV2,
  };
}
