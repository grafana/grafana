import { memo, useEffect, useState } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Alert, ClipboardButton, Field, FieldSet, Input, Switch, TextLink } from '@grafana/ui';
import config from 'app/core/config';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { ThemePicker } from './ThemePicker';
import { ShareModalTabProps } from './types';
import { buildImageUrl, buildShareUrl, getTrackingSource } from './utils';

export interface Props extends ShareModalTabProps {}

export const ShareLink = memo(({ panel, dashboard }: Props) => {
  const [useCurrentTimeRange, setUseCurrentTimeRange] = useState(true);
  const [useShortUrl, setUseShortUrl] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('current');
  const [shareUrl, setShareUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    async function buildUrl() {
      const newShareUrl = await buildShareUrl(useCurrentTimeRange, selectedTheme, panel, useShortUrl);
      const newImageUrl = buildImageUrl(useCurrentTimeRange, dashboard.uid, selectedTheme, panel);

      setShareUrl(newShareUrl);
      setImageUrl(newImageUrl);
    }
    buildUrl();
  }, [useCurrentTimeRange, selectedTheme, useShortUrl, panel, dashboard]);

  const onUseCurrentTimeRangeChange = () => {
    setUseCurrentTimeRange((prev) => !prev);
  };

  const onUrlShorten = () => setUseShortUrl((prev) => !prev);

  const onThemeChange = (value: string) => setSelectedTheme(value);

  const onCopy = () => {
    DashboardInteractions.shareLinkCopied({
      currentTimeRange: useCurrentTimeRange,
      theme: selectedTheme,
      shortenURL: useShortUrl,
      shareResource: getTrackingSource(panel),
    });
  };

  const isRelativeTime = dashboard ? dashboard.time.to === 'now' : false;
  const selectors = e2eSelectors.pages.SharePanelModal;
  const isDashboardSaved = Boolean(dashboard.id);

  const timeRangeLabelTranslation = t('share-modal.link.time-range-label', `Lock time range`);

  const timeRangeDescriptionTranslation = t(
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
        <Field label={timeRangeLabelTranslation} description={isRelativeTime ? timeRangeDescriptionTranslation : ''}>
          <Switch id="share-current-time-range" value={useCurrentTimeRange} onChange={onUseCurrentTimeRangeChange} />
        </Field>
        <ThemePicker selectedTheme={selectedTheme} onChange={onThemeChange} />
        <Field label={shortenURLTranslation}>
          <Switch id="share-shorten-url" value={useShortUrl} onChange={onUrlShorten} />
        </Field>

        <Field label={linkURLTranslation}>
          <Input
            id="link-url-input"
            value={shareUrl}
            readOnly
            addonAfter={
              <ClipboardButton icon="copy" variant="primary" getText={() => shareUrl} onClipboardCopy={onCopy}>
                <Trans i18nKey="share-modal.link.copy-link-button">Copy</Trans>
              </ClipboardButton>
            }
          />
        </Field>
      </FieldSet>

      {panel && config.rendererAvailable && (
        <>
          {isDashboardSaved && (
            <TextLink href={imageUrl} external icon={'camera'} aria-label={selectors.linkToRenderedImage}>
              {t('share-modal.link.rendered-image', 'Direct link rendered image')}
            </TextLink>
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
});

ShareLink.displayName = 'ShareLink';
