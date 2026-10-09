import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { ShareLinkTab, type ShareLinkTabState } from '../../ShareLinkTab';
import { getShareLinkConfiguration, updateShareLinkConfiguration } from '../utils';

const ShareInternallyRenderer = lazy(() =>
  import('../../ShareRenderers').then((m) => ({ default: m.ShareInternallyRenderer }))
);

function LazyShareInternallyRenderer(props: SceneComponentProps<ShareInternally>) {
  return (
    <Suspense fallback={<Spinner />}>
      <ShareInternallyRenderer {...props} />
    </Suspense>
  );
}

export class ShareInternally extends ShareLinkTab {
  static Component = LazyShareInternallyRenderer;

  constructor(state: Partial<ShareLinkTabState>) {
    const { useAbsoluteTimeRange, useShortUrl, theme } = getShareLinkConfiguration();
    super({
      ...state,
      useLockedTime: useAbsoluteTimeRange,
      useShortUrl,
      selectedTheme: theme,
    });

    this.onToggleLockedTime = this.onToggleLockedTime.bind(this);
    this.onUrlShorten = this.onUrlShorten.bind(this);
    this.onThemeChange = this.onThemeChange.bind(this);
  }

  public getTabLabel() {
    return t('share-dashboard.menu.share-internally-title', 'Share internally');
  }

  async onToggleLockedTime() {
    const useLockedTime = !this.state.useLockedTime;
    updateShareLinkConfiguration({
      useAbsoluteTimeRange: useLockedTime,
      useShortUrl: this.state.useShortUrl,
      theme: this.state.selectedTheme,
    });
    await super.onToggleLockedTime();
  }

  async onUrlShorten() {
    const useShortUrl = !this.state.useShortUrl;
    updateShareLinkConfiguration({
      useShortUrl,
      useAbsoluteTimeRange: this.state.useLockedTime,
      theme: this.state.selectedTheme,
    });
    await super.onUrlShorten();
  }

  async onThemeChange(value: string) {
    updateShareLinkConfiguration({
      theme: value,
      useShortUrl: this.state.useShortUrl,
      useAbsoluteTimeRange: this.state.useLockedTime,
    });
    await super.onThemeChange(value);
  }
}
