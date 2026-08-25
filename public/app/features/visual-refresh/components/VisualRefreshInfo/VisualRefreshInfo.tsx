import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { FlagKeys, getLocalStorageProvider, getOFREPWebProvider } from '@grafana/runtime/internal';
import { Alert, Button, Stack } from '@grafana/ui';

import { stylesToggled } from '../../analytics/main';

const VISUAL_REFRESH_FLAG = FlagKeys.GrafanaVisualDesignRefresh;

/**
 * Lets the user opt in or out of the visual design refresh, but only while it's being rolled out.
 */
export function VisualRefreshInfo() {
  // Read the rollout flag from the OFREP provider directly rather than the client, so the local
  // storage override (set by the buttons below) doesn't hide the alert once the user opts out.
  const evaluation = getOFREPWebProvider().flagCache[VISUAL_REFRESH_FLAG];
  const isAvailable = !!evaluation && 'value' in evaluation && evaluation.value === true;

  const override = getLocalStorageProvider().getFlags()[VISUAL_REFRESH_FLAG];
  const [showVisualRefresh, setShowVisualRefresh] = useState(
    override === undefined ? isAvailable : override === 'true'
  );

  if (!isAvailable) {
    return null;
  }

  const handleShowVisualRefresh = (force: boolean) => {
    stylesToggled({ value: force });
    getLocalStorageProvider().setFlags({ [VISUAL_REFRESH_FLAG]: force });
    setShowVisualRefresh(force);
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
