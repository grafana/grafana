import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneComponentProps } from '@grafana/scenes';
import { Alert, ClipboardButton, Divider, Stack, Text, TextLink } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';
import ShareInternallyConfiguration from '../ShareInternallyConfiguration';
import { ShareLinkTab, type ShareLinkTabState } from '../ShareLinkTab';

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
  const { useLockedTime, useShortUrl, selectedTheme, isBuildUrlLoading, imageUrl, panelRef } = model.useState();

  const panelTitle = panelRef?.resolve().state.title;
  const dashboard = getDashboardSceneFor(model);
  const isDashboardSaved = Boolean(dashboard.state.uid);

  return (
    <Stack gap={2} direction="column">
      <Text variant="body">
        <Trans i18nKey="link.share-panel.config-description">
          Create a personalized, direct link to share your panel within your organization, with the following
          customization settings:
        </Trans>
      </Text>
      <Stack gap={2} direction="column" alignItems="flex-start">
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
      </Stack>
      <Divider spacing={0} />
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
              To render an image, you must install the{' '}
              <TextLink href="https://grafana.com/grafana/plugins/grafana-image-renderer" external>
                Grafana image renderer plugin
              </TextLink>
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
    </Stack>
  );
}
