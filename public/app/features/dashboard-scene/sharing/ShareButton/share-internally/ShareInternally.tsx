import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { Alert, ClipboardButton, Divider, Label, Spinner, Stack, Switch, Text, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { ThemePicker } from 'app/features/dashboard/components/ShareModal/ThemePicker';

import { ShareLinkTab } from '../../ShareLinkTab';
import { getShareLinkConfiguration } from '../utils';

export class ShareInternally extends ShareLinkTab {
  static Component = ShareInternallyRenderer;

  constructor(state: { panelRef?: SceneObjectRef<VizPanel> }) {
    const { useAbsoluteTimeRange, useShortUrl, theme } = getShareLinkConfiguration();
    super({
      ...state,
      useLockedTime: useAbsoluteTimeRange,
      useShortUrl,
      selectedTheme: theme,
    });
  }
}

function ShareInternallyRenderer({ model }: SceneComponentProps<ShareInternally>) {
  const styles = useStyles2(getStyles);
  const { useLockedTime, useShortUrl, selectedTheme, isBuildUrlLoading } = model.useState();

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
            customization settings:
          </Trans>
        </Text>
      </div>
      <Stack justifyContent="space-between">
        <Stack gap={2} direction="column">
          <Stack gap={1} direction="column">
            <Stack gap={1} alignItems="start">
              <Switch
                label={t('link.share.time-range-label', 'Lock time range')}
                id="share-current-time-range"
                value={useLockedTime}
                onChange={model.onToggleLockedTime}
              />
              <Label
                description={t(
                  'link.share.time-range-description',
                  'Change the current relative time range to an absolute time range'
                )}
              >
                <Trans i18nKey="link.share.time-range-label">Lock time range</Trans>
              </Label>
            </Stack>
            <Stack gap={1} alignItems="start">
              <Switch
                id="share-short-url"
                value={useShortUrl}
                label={t('link.share.short-url-label', 'Shorten link')}
                onChange={model.onUrlShorten}
              />
              <Label>
                <Trans i18nKey="link.share.short-url-label">Shorten link</Trans>
              </Label>
            </Stack>
          </Stack>
          <ThemePicker selectedTheme={selectedTheme} onChange={model.onThemeChange} />
        </Stack>
        {isBuildUrlLoading && <Spinner />}
      </Stack>
      <Divider spacing={1} />
      <ClipboardButton
        icon="link"
        variant="primary"
        fill="outline"
        disabled={isBuildUrlLoading}
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
