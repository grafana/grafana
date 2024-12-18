import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Alert, ClipboardButton, Divider, Stack, Text, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { getDashboardSceneFor } from '../../utils/utils';
import ShareInternallyConfiguration from '../ShareInternallyConfiguration';
import { ShareLinkTab, ShareLinkTabState } from '../ShareLinkTab';

import { SharePanelPreview } from './SharePanelPreview';

export class SharePanelInternally extends ShareLinkTab {
  static Component = SharePanelInternallyRenderer;

  constructor(state: Partial<ShareLinkTabState>) {
    super(state);
  }

  public getTabLabel() {
    return t('share-panel.drawer.share-link-title', 'Link settings');
  }
}

function SharePanelInternallyRenderer({ model }: SceneComponentProps<SharePanelInternally>) {
  const styles = useStyles2(getStyles);

  const { useLockedTime, useShortUrl, selectedTheme, isBuildUrlLoading, imageUrl, panelRef } = model.useState();

  const panelTitle = panelRef?.resolve().state.title;
  const dashboard = getDashboardSceneFor(model);
  const isDashboardSaved = Boolean(dashboard.state.uid);

  return (
    <div>
      <Text variant="body">
        <Trans i18nKey="link.share-panel.config-description">
          Create a personalized, direct link to share your panel within your organization, with the following
          customization settings:
        </Trans>
      </Text>
      <div className={styles.configurationContainer}>
        <ShareInternallyConfiguration
          useLockedTime={useLockedTime}
          onToggleLockedTime={model.onToggleLockedTime}
          useShortUrl={useShortUrl}
          onUrlShorten={model.onUrlShorten}
          selectedTheme={selectedTheme}
          onChangeTheme={model.onThemeChange}
          isLoading={isBuildUrlLoading}
        />
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
      </div>
      <Divider spacing={2} />
      <Stack gap={2} direction="column">
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
        <SharePanelPreview
          title={panelTitle || ''}
          buildUrl={model.buildUrl}
          imageUrl={imageUrl}
          disabled={!isDashboardSaved}
          theme={selectedTheme}
        />
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  configurationContainer: css({
    marginTop: theme.spacing(2),
  }),
});
