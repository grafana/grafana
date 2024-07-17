import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { Alert, ClipboardButton, Divider, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { getDashboardSceneFor } from '../../utils/utils';
import ShareInternallyConfiguration from '../ShareInternallyConfiguration';
import { ShareLinkTab } from '../ShareLinkTab';

export class SharePanelInternally extends ShareLinkTab {
  static Component = SharePanelInternallyRenderer;

  constructor({ panelRef }: { panelRef?: SceneObjectRef<VizPanel> }) {
    super({
      panelRef,
    });
  }
}

function SharePanelInternallyRenderer({ model }: SceneComponentProps<SharePanelInternally>) {
  const styles = useStyles2(getStyles);
  const { useLockedTime, useShortUrl, selectedTheme, isBuildUrlLoading, imageUrl } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const isDashboardSaved = Boolean(dashboard.state.uid);

  return (
    <>
      <div className={styles.configDescription}>
        <Text variant="body">
          <Trans i18nKey="link.share-panel.config-description">
            Create a personalized, direct link to share your panel within your organization, with the following
            customization settings:
          </Trans>
        </Text>
      </div>
      <ShareInternallyConfiguration
        useLockedTime={useLockedTime}
        onToggleLockedTime={() => model.onToggleLockedTime()}
        useShortUrl={useShortUrl}
        onUrlShorten={() => model.onUrlShorten()}
        selectedTheme={selectedTheme}
        onChangeTheme={(t) => model.onThemeChange(t)}
        isLoading={isBuildUrlLoading}
      />
      <Divider spacing={1} />
      <Stack gap={2} direction="column">
        <div className={styles.buttonsContainer}>
          <Stack gap={1} flex={1} direction={{ xs: 'column', sm: 'row' }}>
            <ClipboardButton
              icon="link"
              variant="primary"
              fill="outline"
              disabled={isBuildUrlLoading}
              getText={model.getShareUrl}
              onClipboardCopy={model.onCopy}
            >
              <Trans i18nKey="link.share.copy-link-button">Copy link</Trans>
            </ClipboardButton>
            <LinkButton
              href={imageUrl}
              icon="external-link-alt"
              target="_blank"
              variant="secondary"
              fill="solid"
              disabled={!config.rendererAvailable || !isDashboardSaved}
              // onClick={onRevokeClick}
            >
              <Trans i18nKey="link.share-panel.render-image">Render image</Trans>
            </LinkButton>
          </Stack>
        </div>
        {!isDashboardSaved && (
          <Alert severity="info" title={t('share-modal.link.save-alert', 'Dashboard is not saved')} bottomSpacing={0}>
            <Trans i18nKey="share-modal.link.save-dashboard">
              To render a panel image, you must save the dashboard first.
            </Trans>
          </Alert>
        )}
        {!config.rendererAvailable && (
          <Alert
            severity="info"
            title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}
            bottomSpacing={0}
          >
            <Trans i18nKey="share-modal.link.render-instructions">
              To render a panel image, you must install the{' '}
              <a
                href="https://grafana.com/grafana/plugins/grafana-image-renderer"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                Grafana image renderer plugin
              </a>
              . Please contact your Grafana administrator to install the plugin.
            </Trans>
          </Alert>
        )}
      </Stack>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  configDescription: css({
    marginBottom: theme.spacing(2),
  }),
  buttonsContainer: css({
    marginTop: theme.spacing(2),
  }),
});
