import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Alert, ClipboardButton, Divider, Stack, Text, useStyles2 } from '@grafana/ui';

import ShareInternallyConfiguration from '../../ShareInternallyConfiguration';

import { type ShareInternally } from './ShareInternally';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareInternally;

export function ShareInternallyRenderer({ model }: SceneComponentProps<ShareInternally>) {
  const styles = useStyles2(getStyles);
  const { useLockedTime, useShortUrl, selectedTheme, isBuildUrlLoading } = model.useState();

  return (
    <div className={selectors.container}>
      <Alert severity="info" title={t('link.share.config-alert-title', 'Link settings')}>
        <Trans i18nKey="link.share.config-alert-description">
          Updating your settings will modify the default copy link to include these changes. Please note that these
          settings are saved within your current browser scope.
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
      <Stack gap={1} flex={1} direction={{ xs: 'column', sm: 'row' }}>
        <ClipboardButton
          icon="link"
          variant="primary"
          fill="outline"
          disabled={isBuildUrlLoading}
          getText={model.getShareUrl}
          onClipboardCopy={model.onCopy}
          className={styles.copyButtonContainer}
          data-testid={selectors.copyUrlButton}
        >
          <Trans i18nKey="link.share.copy-link-button">Copy link</Trans>
        </ClipboardButton>
      </Stack>
    </div>
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
