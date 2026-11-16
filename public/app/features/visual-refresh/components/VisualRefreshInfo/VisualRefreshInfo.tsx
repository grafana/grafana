import { t, Trans } from '@grafana/i18n';
import {
  FlagKeys,
  getLocalStorageProvider,
  getOFREPWebProvider,
  useFlagGrafanaVisualDesignRefresh,
} from '@grafana/runtime/internal';
import { Alert, Button, Stack, TextLink } from '@grafana/ui';

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

  const title = showVisualRefresh
    ? t('visual-refresh.info.title-visual-refresh', 'Grafana has a new look')
    : t('visual-refresh.info.title', 'Grafana has a new look. Ready to try it?');

  return (
    <Alert title={title} bottomSpacing={0} severity="info">
      <Stack direction="row" alignItems="flex-start" wrap justifyContent="space-between">
        <span>
          <Trans i18nKey="visual-refresh.info.description">
            The new UI is currently in Public Preview.{' '}
            <TextLink href="https://grafana.com/whats-new/2026-10-26-grafana-visual-ui-refresh/" external>
              Learn more.
            </TextLink>
          </Trans>
        </span>
        {showVisualRefresh ? (
          <Button icon="arrow-left" onClick={() => handleShowVisualRefresh(false)} variant="secondary" size="sm">
            <Trans i18nKey="visual-refresh.info.revert">Use old style</Trans>
          </Button>
        ) : (
          <Button icon="arrow-right" onClick={() => handleShowVisualRefresh(true)} variant="secondary" size="sm">
            <Trans i18nKey="visual-refresh.info.apply">Try new style</Trans>
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
