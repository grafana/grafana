import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Alert, ClipboardButton, Field, FieldSet, Icon, Input, Switch, TextLink } from '@grafana/ui';
import { ThemePicker } from 'app/features/dashboard/components/ShareModal/ThemePicker';

import { getDashboardSceneFor } from '../utils/utils';

import { type ShareLinkTab } from './ShareLinkTab';

export function ShareLinkTabRenderer({ model }: SceneComponentProps<ShareLinkTab>) {
  const state = model.useState();
  const { panelRef } = state;

  const dashboard = getDashboardSceneFor(model);
  const panel = panelRef?.resolve();

  const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);
  const isRelativeTime = timeRange.state.to === 'now' ? true : false;

  const { useLockedTime, useShortUrl, selectedTheme, shareUrl, absoluteImageUrl } = state;

  const selectors = e2eSelectors.pages.SharePanelModal;
  const isDashboardSaved = Boolean(dashboard.state.uid);

  const lockTimeRangeLabel = t('share-modal.link.time-range-label', `Lock time range`);

  const lockTimeRangeDescription = t(
    'share-modal.link.time-range-description',
    `Transforms the current relative time range to an absolute time range`
  );

  const shortenURLTranslation = t('share-modal.link.shorten-url', `Shorten URL`);

  const linkURLTranslation = t('share-modal.link.link-url', `Link URL`);

  return (
    <>
      <p>
        <Trans i18nKey="share-modal.link.info-text">
          Create a direct link to this dashboard or panel, customized with the options below.
        </Trans>
      </p>
      <FieldSet>
        <Field label={lockTimeRangeLabel} description={isRelativeTime ? lockTimeRangeDescription : ''}>
          <Switch id="share-current-time-range" value={useLockedTime} onChange={model.onToggleLockedTime} />
        </Field>
        <ThemePicker selectedTheme={selectedTheme} onChange={model.onThemeChange} />
        <Field label={shortenURLTranslation}>
          <Switch id="share-shorten-url" value={useShortUrl} onChange={model.onUrlShorten} />
        </Field>

        <Field label={linkURLTranslation}>
          <Input
            id="link-url-input"
            value={shareUrl}
            readOnly
            addonAfter={
              <ClipboardButton icon="copy" variant="primary" getText={model.getShareUrl} onClipboardCopy={model.onCopy}>
                <Trans i18nKey="share-modal.link.copy-link-button">Copy</Trans>
              </ClipboardButton>
            }
          />
        </Field>
      </FieldSet>

      {panel && config.rendererAvailable && (
        <>
          {isDashboardSaved && (
            <div className="gf-form">
              <a href={absoluteImageUrl} target="_blank" rel="noreferrer" aria-label={selectors.linkToRenderedImage}>
                <Icon name="camera" />
                &nbsp;
                <Trans i18nKey="share-modal.link.rendered-image">Direct link rendered image</Trans>
              </a>
            </div>
          )}

          {!isDashboardSaved && (
            <Alert severity="info" title={t('share-modal.link.save-alert', 'Dashboard is not saved')} bottomSpacing={0}>
              <Trans i18nKey="share-modal.link.save-dashboard">
                To render a panel image, you must save the dashboard first.
              </Trans>
            </Alert>
          )}
        </>
      )}

      {panel && !config.rendererAvailable && (
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
    </>
  );
}
