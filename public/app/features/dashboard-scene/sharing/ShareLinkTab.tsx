import React from 'react';

import { UrlQueryMap } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectRef,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { Alert, ClipboardButton, Field, FieldSet, Icon, Input, Switch } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { createShortLink } from 'app/core/utils/shortLinks';
import { ThemePicker } from 'app/features/dashboard/components/ShareModal/ThemePicker';
import { trackDashboardSharingActionPerType } from 'app/features/dashboard/components/ShareModal/analytics';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardUrl } from '../utils/utils';

export interface ShareLinkTabState extends SceneObjectState, ShareOptions {
  panelRef?: SceneObjectRef<VizPanel>;
  dashboardRef: SceneObjectRef<DashboardScene>;
}

interface ShareOptions {
  useCurrentTimeRange: boolean;
  useShortUrl: boolean;
  selectedTheme: string;
  shareUrl: string;
  imageUrl: string;
}

export class ShareLinkTab extends SceneObjectBase<ShareLinkTabState> {
  constructor(state: Omit<ShareLinkTabState, keyof ShareOptions>) {
    super({
      ...state,
      useCurrentTimeRange: true,
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
    const { panelRef, dashboardRef, useCurrentTimeRange, useShortUrl, selectedTheme } = this.state;
    const dashboard = dashboardRef.resolve();
    const panel = panelRef?.resolve();
    const location = locationService.getLocation();

    const urlParamsUpdate: UrlQueryMap = {};

    if (panel) {
      urlParamsUpdate.viewPanel = panel.state.key;
    }

    if (useCurrentTimeRange) {
      const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);
      urlParamsUpdate.from = timeRange.state.value.from.toISOString();
      urlParamsUpdate.to = timeRange.state.value.to.toISOString();
    }

    if (selectedTheme !== 'current') {
      urlParamsUpdate.theme = selectedTheme!;
    }

    let shareUrl = getDashboardUrl({
      uid: dashboard.state.uid,
      currentQueryParams: location.search,
      updateQuery: urlParamsUpdate,
    });

    shareUrl = new URL(shareUrl, config.appUrl).toString();

    if (useShortUrl) {
      shareUrl = await createShortLink(shareUrl);
    }

    this.setState({ shareUrl, imageUrl: 'image url' });
  }

  public getTabLabel() {
    return t('share-modal.tab-title.link', 'Link');
  }

  onUseCurrentTimeRangeChange = () => {
    this.setState({ useCurrentTimeRange: !this.state.useCurrentTimeRange });
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
    trackDashboardSharingActionPerType('copy_link', shareDashboardType.link);
  }

  static Component = ({ model }: SceneComponentProps<ShareLinkTab>) => {
    const state = model.useState();
    const { panelRef, dashboardRef } = state;

    const dashboard = dashboardRef.resolve();
    const panel = panelRef?.resolve();

    const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);
    const isRelativeTime = timeRange.state.to === 'now' ? true : false;

    const { useCurrentTimeRange, useShortUrl, selectedTheme, shareUrl, imageUrl } = state;

    const selectors = e2eSelectors.pages.SharePanelModal;
    const isDashboardSaved = Boolean(dashboard.state.uid);

    const timeRangeLabelTranslation = t('share-modal.link.time-range-label', `Lock time range`);

    const timeRangeDescriptionTranslation = t(
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
          <Field label={timeRangeLabelTranslation} description={isRelativeTime ? timeRangeDescriptionTranslation : ''}>
            <Switch
              id="share-current-time-range"
              value={useCurrentTimeRange}
              onChange={model.onUseCurrentTimeRangeChange}
            />
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
                <ClipboardButton
                  icon="copy"
                  variant="primary"
                  getText={model.getShareUrl}
                  onClipboardCopy={model.onCopy}
                >
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
  };
}

// function buildParams({
//   useCurrentTimeRange,
//   selectedTheme,
//   panel,
//   search = window.location.search,
//   orgId = config.bootData.user.orgId,
// }: BuildParamsArgs): URLSearchParams {
//   const searchParams = new URLSearchParams(search);
//   const relative = panel?.timeFrom;

//   // Use panel's relative time if it's set
//   if (relative) {
//     const { from, to } = rangeUtil.describeTextRange(relative);
//     searchParams.set('from', from);
//     searchParams.set('to', to);
//   } else {
//     searchParams.set('from', String(range.from.valueOf()));
//     searchParams.set('to', String(range.to.valueOf()));
//   }
//   searchParams.set('orgId', String(orgId));

//   if (!useCurrentTimeRange) {
//     searchParams.delete('from');
//     searchParams.delete('to');
//   }

//   if (selectedTheme !== 'current') {
//     searchParams.set('theme', selectedTheme!);
//   }

//   if (panel && !searchParams.has('editPanel')) {
//     searchParams.set('viewPanel', String(panel.id));
//   }

//   return searchParams;
// }
