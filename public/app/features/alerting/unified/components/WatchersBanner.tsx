import { useCallback, useState } from 'react';

import { store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, LinkButton, Stack, Text } from '@grafana/ui';

import { trackWatchersBannerClick, trackWatchersBannerDismiss } from '../Analytics';
import { usePluginBridge } from '../hooks/usePluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';
import { createRelativeUrl } from '../utils/url';

const WATCHERS_PATH = `/a/${SupportedPlugin.Assistant}/watchers`;

// Scope dismissal per org so hiding the banner in one org does not hide it in another
export function getWatchersBannerDismissedKey(orgId: number): string {
  return `grafana.alerting.watchers_banner.dismissed-org-${orgId}`;
}

/**
 * Promotes Watchers, the Grafana Assistant's proactive agents. Renders only when the Assistant
 * plugin is installed and enabled, since the CTA links into it. Dismissal is persisted per org.
 */
export function WatchersBanner() {
  const { installed } = usePluginBridge(SupportedPlugin.Assistant);
  const key = getWatchersBannerDismissedKey(config.bootData.user.orgId);
  const [dismissed, setDismissed] = useState(() => store.getBool(key, false));

  const dismiss = useCallback(() => {
    store.set(key, true);
    setDismissed(true);
    trackWatchersBannerDismiss();
  }, [key]);

  if (!installed || dismissed) {
    return null;
  }

  return (
    <Alert
      severity="info"
      title={t('alerting.watchers-banner.title', 'Assistant Watchers are now generally available')}
      onRemove={dismiss}
    >
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="alerting.watchers-banner.description">
            Create a calibrated proactive agent that inspects telemetry on a schedule and surfaces potential issues to
            you.
          </Trans>
        </Text>
        <div>
          <LinkButton
            href={createRelativeUrl(WATCHERS_PATH)}
            variant="primary"
            size="sm"
            onClick={trackWatchersBannerClick}
          >
            <Trans i18nKey="alerting.watchers-banner.open-button">Create a Watcher</Trans>
          </LinkButton>
        </div>
      </Stack>
    </Alert>
  );
}
