import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { Alert, ClipboardButton, Divider, Label, Stack, Switch, Text, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { ThemePicker } from 'app/features/dashboard/components/ShareModal/ThemePicker';

import { DashboardScene } from '../../../scene/DashboardScene';
import { ShareLinkTab } from '../../ShareLinkTab';
import { getShareLinkConfigurationFromStorage } from '../utils';

export class ShareInternally extends ShareLinkTab {
  static Component = ShareInternallyRenderer;

  constructor(state: { dashboardRef: SceneObjectRef<DashboardScene>; panelRef?: SceneObjectRef<VizPanel> }) {
    const { useLockedTime, useShortUrl, selectedTheme } = getShareLinkConfigurationFromStorage() || {
      useLockedTime: true,
      useShortUrl: true,
      selectedTheme: 'current',
    };

    super({
      ...state,
      useLockedTime,
      useShortUrl,
      selectedTheme,
      shareUrl: '',
      imageUrl: '',
    });
  }
}

function ShareInternallyRenderer({ model }: SceneComponentProps<ShareInternally>) {
  const styles = useStyles2(getStyles);
  const { useLockedTime, useShortUrl, selectedTheme } = model.useState();

  return (
    <>
      <Alert severity="info" title={t('link.share.config-alert-title', 'Link configuration')}>
        <Trans i18nKey="link.share.config-alert-description">
          Updating your settings will modify the default copy link to include these changes.
        </Trans>
      </Alert>
      <div className={styles.configDescription}>
        <Text variant="body">
          <Trans i18nKey="link.share.config-description">
            Create a personalized, direct link to share your dashboard within your organization, with the following
            customization options:
          </Trans>
        </Text>
      </div>
      <Stack gap={2} direction="column">
        <Stack gap={1} direction="column">
          <Stack gap={1}>
            <Switch
              label={t('link.share.time-range-label', 'Lock time range')}
              id="share-current-time-range"
              value={useLockedTime}
              onChange={model.onToggleLockedTime}
            />
            <Label
              style={{ flex: 1 }}
              description={t(
                'link.share.time-range-description',
                'Change the current relative time range to an absolute time range'
              )}
            >
              <Trans i18nKey="link.share.time-range-label">Lock time range</Trans>
            </Label>
          </Stack>
          <Stack gap={1}>
            <Switch
              id="share-shorten-url"
              value={useShortUrl}
              label={t('link.share.shorten-url-label', 'Shorten URL')}
              onChange={model.onUrlShorten}
            />
            <Label style={{ flex: 1 }}>
              <Trans i18nKey="link.share.shorten-url-label">Shorten URL</Trans>
            </Label>
          </Stack>
        </Stack>
        <ThemePicker selectedTheme={selectedTheme} onChange={model.onThemeChange} />
      </Stack>
      <Divider spacing={1} />
      <ClipboardButton
        icon="link"
        variant="primary"
        fill="outline"
        getText={model.getShareUrl}
        onClipboardCopy={model.onCopy}
        className={styles.copyButtonContainer}
      >
        <Trans i18nKey="link.share.copy-link-button">Copy link</Trans>
      </ClipboardButton>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  configDescription: css({
    marginBottom: theme.spacing(2),
  }),
  copyButtonContainer: css({
    marginTop: theme.spacing(2),
  }),
});
