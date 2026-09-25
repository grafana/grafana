import { lazy, Suspense } from 'react';

import { dateTime, type UrlQueryMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  type SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  type SceneObjectRef,
  type VizPanel,
} from '@grafana/scenes';
import { type TimeZone } from '@grafana/schema';
import { Spinner } from '@grafana/ui';
import { createDashboardShareUrl, createShortLink, getShareUrlParams } from 'app/core/utils/shortLinks';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { getDashboardUrl } from '../utils/getDashboardUrl';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { type SceneShareTabState, type ShareView } from './types';

const ShareLinkTabRenderer = lazy(() =>
  import('./ShareRenderers').then((m) => ({ default: m.ShareLinkTabRenderer }))
);

function LazyShareLinkTabRenderer(props: SceneComponentProps<ShareLinkTab>) {
  return (
    <Suspense fallback={<Spinner />}>
      <ShareLinkTabRenderer {...props} />
    </Suspense>
  );
}

export interface ShareLinkTabState extends SceneShareTabState, ShareOptions {
  panelRef?: SceneObjectRef<VizPanel>;
}

interface ShareLinkConfiguration {
  useLockedTime: boolean;
  useShortUrl: boolean;
  selectedTheme: string;
}

interface ShareOptions extends ShareLinkConfiguration {
  shareUrl: string;
  imageUrl: string;
  absoluteImageUrl: string;
  isBuildUrlLoading: boolean;
}

export class ShareLinkTab extends SceneObjectBase<ShareLinkTabState> implements ShareView {
  public tabId = shareDashboardType.link;

  static Component = LazyShareLinkTabRenderer;

  constructor(state: Partial<ShareLinkTabState>) {
    super({
      ...state,
      useLockedTime: state.useLockedTime ?? true,
      useShortUrl: state.useShortUrl ?? false,
      selectedTheme: state.selectedTheme ?? 'current',
      shareUrl: '',
      imageUrl: '',
      absoluteImageUrl: '',
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
      try {
        shareUrl = await createShortLink(shareUrl);
      } catch {
        this.setState({ isBuildUrlLoading: false });
        return;
      }
    }

    const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);
    const urlParamsUpdate = getShareUrlParams(opts, timeRange, panel);

    // the image panel solo route uses panelId instead of viewPanel
    let imageQueryParams = urlParamsUpdate;
    if (panel) {
      delete imageQueryParams.viewPanel;
      imageQueryParams.panelId = panel.getPathId();
    }

    // hide Grafana logo in the rendered image
    urlParamsUpdate.hideLogo = 'true';

    const imageUrl = getDashboardUrl({
      uid: dashboard.state.uid,
      currentQueryParams: window.location.search,
      updateQuery: { ...urlParamsUpdate, ...queryOptions, panelId: panel?.getPathId() },
      absolute: false,
      soloRoute: true,
      render: true,
      timeZone: getRenderTimeZone(timeRange.getTimeZone()),
    });
    const absoluteImageUrl = config.appUrl + imageUrl.replace(/^\//, '');

    this.setState({ shareUrl, imageUrl, absoluteImageUrl, isBuildUrlLoading: false });
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
