import { PureComponent } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Alert, ClipboardButton, Field, FieldSet, Input, Switch, TextLink } from '@grafana/ui';
import config from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { ThemePicker } from './ThemePicker';
import { ShareModalTabProps } from './types';
import { buildImageUrl, buildShareUrl, getTrackingSource } from './utils';

export interface Props extends ShareModalTabProps {}

export interface State {
  useCurrentTimeRange: boolean;
  useShortUrl: boolean;
  selectedTheme: string;
  shareUrl: string;
  imageUrl: string;
}

export class ShareLink extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      useCurrentTimeRange: true,
      useShortUrl: false,
      selectedTheme: 'current',
      shareUrl: '',
      imageUrl: '',
    };
  }

  componentDidMount() {
    this.buildUrl();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { useCurrentTimeRange, useShortUrl, selectedTheme } = this.state;
    if (
      prevState.useCurrentTimeRange !== useCurrentTimeRange ||
      prevState.selectedTheme !== selectedTheme ||
      prevState.useShortUrl !== useShortUrl
    ) {
      this.buildUrl();
    }
  }

  buildUrl = async () => {
    const { panel, dashboard } = this.props;
    const { useCurrentTimeRange, useShortUrl, selectedTheme } = this.state;

    const shareUrl = await buildShareUrl(useCurrentTimeRange, selectedTheme, panel, useShortUrl);
    const imageUrl = buildImageUrl(useCurrentTimeRange, dashboard.uid, selectedTheme, panel);

    this.setState({ shareUrl, imageUrl });
  };

  onUseCurrentTimeRangeChange = () => {
    this.setState({ useCurrentTimeRange: !this.state.useCurrentTimeRange });
  };

  onUrlShorten = () => {
    this.setState({ useShortUrl: !this.state.useShortUrl });
  };

  onThemeChange = (value: string) => {
    this.setState({ selectedTheme: value });
  };

  getShareUrl = () => {
    return this.state.shareUrl;
  };

  onCopy = () => {
    DashboardInteractions.shareLinkCopied({
      currentTimeRange: this.state.useCurrentTimeRange,
      theme: this.state.selectedTheme,
      shortenURL: this.state.useShortUrl,
      shareResource: getTrackingSource(this.props.panel),
    });
  };

  render() {
    const { panel, dashboard } = this.props;
    const isRelativeTime = dashboard ? dashboard.time.to === 'now' : false;
    const { useCurrentTimeRange, useShortUrl, selectedTheme, shareUrl, imageUrl } = this.state;
    const selectors = e2eSelectors.pages.SharePanelModal;
    const isDashboardSaved = Boolean(dashboard.id);
    // @PERCONA
    const isPMM = !!(config.bootData.navTree || []).find((item) => item.id === 'pmm');
    const differentLocalhostDomains =
      isPMM && config.appUrl.includes('localhost') && !window.location.host.includes('localhost');

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
            <Switch
              id="share-current-time-range"
              value={useCurrentTimeRange}
              onChange={this.onUseCurrentTimeRangeChange}
            />
          </Field>
          <ThemePicker selectedTheme={selectedTheme} onChange={this.onThemeChange} />
          {/* @PERCONA */}
          {differentLocalhostDomains && (
            <Alert title="PMM: URL mismatch" severity="warning">
              <p>
                Your domain on Grafana&apos;s .ini file is localhost but you are on a different domain. The short URL
                will point to localhost, which might be wrong.
              </p>
              <p>
                Please change your .ini and restart Grafana if you want the URL shortener to function correctly, or just
                use the full URL.
              </p>
            </Alert>
          )}
          <Field label={shortenURLTranslation}>
            <Switch id="share-shorten-url" value={useShortUrl} onChange={this.onUrlShorten} />
          </Field>

          <Field label={linkURLTranslation}>
            <Input
              id="link-url-input"
              value={shareUrl}
              readOnly
              addonAfter={
                <ClipboardButton icon="copy" variant="primary" getText={this.getShareUrl} onClipboardCopy={this.onCopy}>
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
              <Alert
                severity="info"
                title={t('share-modal.link.save-alert', 'Dashboard is not saved')}
                bottomSpacing={0}
              >
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
            {/* @PERCONA */}
            {/* We modified this text and link */}
            To render a panel image, you must install the{' '}
            <a href="https://per.co.na/share_png" target="_blank" rel="noopener noreferrer" className="external-link">
              Image Renderer plugin
            </a>
            . Please contact your PMM administrator to install the plugin.
          </Alert>
        )}
      </>
    );
  }
}
