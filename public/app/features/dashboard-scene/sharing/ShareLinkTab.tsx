import { dateTime, UrlQueryMap } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { TimeZone } from '@grafana/schema';
import { Alert, ClipboardButton, Field, FieldSet, Icon, Input, Switch } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { createDashboardShareUrl, createShortLink, getShareUrlParams } from 'app/core/utils/shortLinks';
import { ThemePicker } from 'app/features/dashboard/components/ShareModal/ThemePicker';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { getDashboardUrl } from '../utils/getDashboardUrl';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { SceneShareTabState, ShareView } from './types';

export interface ShareLinkTabState extends SceneShareTabState, ShareOptions {
  panelRef?: SceneObjectRef<VizPanel>;
}

export interface ShareLinkConfiguration {
  useLockedTime: boolean;
  useShortUrl: boolean;
  selectedTheme: string;
}

interface ShareOptions extends ShareLinkConfiguration {
  shareUrl: string;
  imageUrl: string;
  isBuildUrlLoading: boolean;
}

export class ShareLinkTab extends SceneObjectBase<ShareLinkTabState> implements ShareView {
  public tabId = shareDashboardType.link;

  static Component = ShareLinkTabRenderer;

  constructor(state: Partial<ShareLinkTabState>) {
    super({
      ...state,
      useLockedTime: state.useLockedTime ?? true,
      useShortUrl: state.useShortUrl ?? false,
      selectedTheme: state.selectedTheme ?? 'current',
      shareUrl: '',
      imageUrl: '',
      isBuildUrlLoading: false,
    });

    this.addActivationHandler(() => {
      this.buildUrl();
    });

    this.onToggleLockedTime = this.onToggleLockedTime.bind(this);
    this.onUrlShorten = this.onUrlShorten.bind(this);
    this.onThemeChange = this.onThemeChange.bind(this);
  }

  buildUrl = async (queryOptions?: UrlQueryMap) => {
    this.setState({ isBuildUrlLoading: true });
    const { panelRef, useLockedTime: useAbsoluteTimeRange, useShortUrl, selectedTheme } = this.state;
    const dashboard = getDashboardSceneFor(this);
    const panel = panelRef?.resolve();

    const opts = { useAbsoluteTimeRange, theme: selectedTheme, useShortUrl };
    let shareUrl = createDashboardShareUrl(dashboard, opts, panel);

    if (useShortUrl) {
      shareUrl = await createShortLink(shareUrl);
    }

    const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);
    const urlParamsUpdate = getShareUrlParams(opts, timeRange, panel);

    // the image panel solo route uses panelId instead of viewPanel
    let imageQueryParams = urlParamsUpdate;
    if (panel) {
      delete imageQueryParams.viewPanel;
      imageQueryParams.panelId = panel.state.key;
      // force solo route to use scenes
      imageQueryParams['__feature.dashboardSceneSolo'] = true;
    }

    const imageUrl = getDashboardUrl({
      uid: dashboard.state.uid,
      currentQueryParams: location.search,
      updateQuery: { ...urlParamsUpdate, ...queryOptions, panelId: panel?.state.key },
      absolute: true,
      soloRoute: true,
      render: true,
      timeZone: getRenderTimeZone(timeRange.getTimeZone()),
    });

    this.setState({ shareUrl, imageUrl, isBuildUrlLoading: false });
  };

  public getTabLabel() {
    return t('share-modal.tab-title.link', 'Link');
  }

  async onToggleLockedTime() {
    const useLockedTime = !this.state.useLockedTime;
    this.setState({ useLockedTime });
    await this.buildUrl();
  }

  async onUrlShorten() {
    const useShortUrl = !this.state.useShortUrl;
    this.setState({ useShortUrl });
    await this.buildUrl();
  }

  async onThemeChange(value: string) {
    this.setState({ selectedTheme: value });
    await this.buildUrl();
  }

  getShareUrl = () => {
    return this.state.shareUrl;
  };

  onCopy = () => {
    DashboardInteractions.shareLinkCopied({
      currentTimeRange: this.state.useLockedTime,
      theme: this.state.selectedTheme,
      shortenURL: this.state.useShortUrl,
      shareResource: getTrackingSource(this.state.panelRef),
    });
  };
}

function ShareLinkTabRenderer({ model }: SceneComponentProps<ShareLinkTab>) {
  const state = model.useState();
  const { panelRef } = state;

  const dashboard = getDashboardSceneFor(model);
  const panel = panelRef?.resolve();

  const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);
  const isRelativeTime = timeRange.state.to === 'now' ? true : false;

  const { useLockedTime, useShortUrl, selectedTheme, shareUrl, imageUrl } = state;

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
              <a href={imageUrl} target="_blank" rel="noreferrer" aria-label={selectors.linkToRenderedImage}>
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
    </>
  );
}

function getRenderTimeZone(timeZone: TimeZone): string {
  const utcOffset = 'UTC' + encodeURIComponent(dateTime().format('Z'));

  if (timeZone === 'utc') {
    return 'UTC';
  }

  if (timeZone === 'browser') {
    if (!window.Intl) {
      return utcOffset;
    }

    const dateFormat = window.Intl.DateTimeFormat();
    const options = dateFormat.resolvedOptions();
    if (!options.timeZone) {
      return utcOffset;
    }

    return options.timeZone;
  }

  return timeZone;
}
