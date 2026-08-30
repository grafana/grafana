import { t, Trans } from '@grafana/i18n';
import {
  FlagKeys,
  getLocalStorageProvider,
  getOFREPWebProvider,
  useFlagGrafanaVisualDesignRefresh,
} from '@grafana/runtime/internal';
import { Alert, Button, Stack } from '@grafana/ui';

import { stylesToggled } from '../../analytics/main';

const VISUAL_REFRESH_FLAG = FlagKeys.GrafanaVisualDesignRefresh;

/**
 * Lets the user opt in or out of the visual design refresh, but only while it's being rolled out.
 */
export function VisualRefreshInfo() {
  // Read the rollout flag from the OFREP provider directly
  // This controls whether the alert is shown at all, and is not affected by the local storage override below.
  const evaluation = getOFREPWebProvider().flagCache[VISUAL_REFRESH_FLAG];
  const isAvailable = !!evaluation && 'value' in evaluation && evaluation.value === true;

  const showVisualRefresh = useFlagGrafanaVisualDesignRefresh();

  if (!isAvailable) {
    return null;
  }

  const handleShowVisualRefresh = (force: boolean) => {
    stylesToggled({ value: force });
    // rather than explicitly set true, we instead remove the override from local storage
    // this prevents users from being stuck in the visual refresh if the rollout flag is later disabled
    getLocalStorageProvider().setFlags({ [VISUAL_REFRESH_FLAG]: force ? undefined : false });
  };

  return (
    <Alert title="" bottomSpacing={0} aria-label={t('visual-refresh.info.title', 'New styles')} severity="info">
      <Stack direction="row" alignItems="flex-start" wrap justifyContent="space-between">
        <Trans i18nKey="visual-refresh.info.description">We&apos;ve had a redesign!</Trans>
        {showVisualRefresh ? (
          <Button icon="arrow-left" onClick={() => handleShowVisualRefresh(false)} variant="secondary" size="sm">
            <Trans i18nKey="visual-refresh.info.revert">Take me back</Trans>
          </Button>
        ) : (
          <Button icon="check" onClick={() => handleShowVisualRefresh(true)} variant="success" size="sm">
            <Trans i18nKey="visual-refresh.info.apply">Check it out</Trans>
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
