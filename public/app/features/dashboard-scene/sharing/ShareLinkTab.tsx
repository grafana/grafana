import React from 'react';

import { dateTime, UrlQueryMap } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, VizPanel, sceneGraph } from '@grafana/scenes';
import { TimeZone } from '@grafana/schema';
import { Alert, ClipboardButton, Field, FieldSet, Icon, Input, Switch } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { createShortLink } from 'app/core/utils/shortLinks';
import { ThemePicker } from 'app/features/dashboard/components/ShareModal/ThemePicker';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardUrl } from '../utils/urlBuilders';

import { SceneShareTabState } from './types';
export interface ShareLinkTabState extends SceneShareTabState, ShareOptions {
  panelRef?: SceneObjectRef<VizPanel>;
  dashboardRef: SceneObjectRef<DashboardScene>;
}

interface ShareOptions {
  useLockedTime: boolean;
  useShortUrl: boolean;
  selectedTheme: string;
  shareUrl: string;
  imageUrl: string;
}

export class ShareLinkTab extends SceneObjectBase<ShareLinkTabState> {
  public tabId = shareDashboardType.link;

  static Component = ShareLinkTabRenderer;

  constructor(state: Omit<ShareLinkTabState, keyof ShareOptions>) {
    super({
      ...state,
      useLockedTime: true,
      useShortUrl: false,
      selectedTheme: 'current',
      shareUrl: '',
      imageUrl: '',
    });

    this.addActivationHandler(() => {
      this.buildUrl();
    });
  }

  async buildUrl() {
    const { panelRef, dashboardRef, useLockedTime: useAbsoluteTimeRange, useShortUrl, selectedTheme } = this.state;
    const dashboard = dashboardRef.resolve();
    const panel = panelRef?.resolve();
    const location = locationService.getLocation();
    const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);

    const urlParamsUpdate: UrlQueryMap = {};

    if (panel) {
      urlParamsUpdate.viewPanel = panel.state.key;
    }

    if (useAbsoluteTimeRange) {
      urlParamsUpdate.from = timeRange.state.value.from.toISOString();
      urlParamsUpdate.to = timeRange.state.value.to.toISOString();
    }

    if (selectedTheme !== 'current') {
      urlParamsUpdate.theme = selectedTheme!;
    }

    let shareUrl = getDashboardUrl({
      uid: dashboard.state.uid,
      slug: dashboard.state.meta.slug,
      currentQueryParams: location.search,
      updateQuery: urlParamsUpdate,
      absolute: true,
    });

    if (useShortUrl) {
      shareUrl = await createShortLink(shareUrl);
    }

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
      updateQuery: { ...urlParamsUpdate, panelId: panel?.state.key },
      absolute: true,
      soloRoute: true,
      render: true,
      timeZone: getRenderTimeZone(timeRange.getTimeZone()),
    });

    this.setState({ shareUrl, imageUrl });
  }

  public getTabLabel() {
    return t('share-modal.tab-title.link', 'Link');
  }

  onToggleLockedTime = () => {
    this.setState({ useLockedTime: !this.state.useLockedTime });
    this.buildUrl();
  };

  onUrlShorten = () => {
    this.setState({ useShortUrl: !this.state.useShortUrl });
    this.buildUrl();
  };

  onThemeChange = (value: string) => {
    this.setState({ selectedTheme: value });
    this.buildUrl();
  };

  getShareUrl = () => {
    return this.state.shareUrl;
  };

  onCopy() {
    DashboardInteractions.shareLinkCopied({
      currentTimeRange: this.state.useLockedTime,
      theme: this.state.selectedTheme,
      shortenURL: this.state.useShortUrl,
    });
  }
}

function ShareLinkTabRenderer({ model }: SceneComponentProps<ShareLinkTab>) {
  const state = model.useState();
  const { panelRef, dashboardRef } = state;

  const dashboard = dashboardRef.resolve();
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
      <p className="share-modal-info-text">
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
            To render a panel image, you must install the
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
