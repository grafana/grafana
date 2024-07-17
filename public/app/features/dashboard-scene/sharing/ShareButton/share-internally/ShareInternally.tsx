import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { Alert, ClipboardButton, Divider, Text, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import ShareInternallyConfiguration from '../../ShareInternallyConfiguration';
import { ShareLinkTab } from '../../ShareLinkTab';
import { getShareLinkConfiguration, updateShareLinkConfiguration } from '../utils';

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

  onToggleLockedTime = async () => {
    const useLockedTime = !this.state.useLockedTime;
    updateShareLinkConfiguration({
      useAbsoluteTimeRange: useLockedTime,
      useShortUrl: this.state.useShortUrl,
      theme: this.state.selectedTheme,
    });
    await super.onToggleLockedTime();
  };

  onUrlShorten = async () => {
    const useShortUrl = !this.state.useShortUrl;
    updateShareLinkConfiguration({
      useShortUrl,
      useAbsoluteTimeRange: this.state.useLockedTime,
      theme: this.state.selectedTheme,
    });
    await super.onUrlShorten();
  };

  onThemeChange = async (value: string) => {
    updateShareLinkConfiguration({
      theme: value,
      useShortUrl: this.state.useShortUrl,
      useAbsoluteTimeRange: this.state.useLockedTime,
    });
    await super.onThemeChange(value);
  };
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
      <ShareInternallyConfiguration
        useLockedTime={useLockedTime}
        onToggleLockedTime={model.onToggleLockedTime}
        useShortUrl={useShortUrl}
        onUrlShorten={model.onUrlShorten}
        selectedTheme={selectedTheme}
        onChangeTheme={model.onThemeChange}
        isLoading={isBuildUrlLoading}
      />
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
