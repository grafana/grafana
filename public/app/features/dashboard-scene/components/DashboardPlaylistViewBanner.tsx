import { css } from '@emotion/css';
import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import {
  getPlaylistCustomViewQueryString,
  getPlaylistCustomViewChannelName,
  PLAYLIST_CUSTOM_VIEW_MESSAGE,
  PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM,
} from 'app/features/playlist/customView';

export function DashboardPlaylistViewBanner() {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Keep the token for the lifetime of this dashboard even if URL synchronization
  // later removes unknown query parameters while variables or time range change.
  const [token] = useState(() => searchParams.get(PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM));

  if (!token) {
    return null;
  }

  const close = () => window.close();
  const useCurrentView = () => {
    const channel = new BroadcastChannel(getPlaylistCustomViewChannelName(token));
    channel.postMessage({
      type: PLAYLIST_CUSTOM_VIEW_MESSAGE,
      token,
      queryString: getPlaylistCustomViewQueryString(location.search),
    });
    channel.close();
    close();
  };

  return (
    <Alert
      title={t('dashboard-scene.playlist-view-banner.title', 'Configuring playlist custom view')}
      severity="info"
      className={styles.banner}
    >
      <div className={styles.content}>
        <Trans i18nKey="dashboard-scene.playlist-view-banner.body">
          Adjust dashboard variables and time range, then use this view in your playlist.
        </Trans>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={close}>
            <Trans i18nKey="dashboard-scene.playlist-view-banner.cancel">Cancel</Trans>
          </Button>
          <Button size="sm" onClick={useCurrentView}>
            <Trans i18nKey="dashboard-scene.playlist-view-banner.use-view">Use this view</Trans>
          </Button>
        </div>
      </div>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    flex: 0,
    margin: theme.spacing(2, 2, 0, 2),
  }),
  content: css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
  }),
  actions: css({
    display: 'flex',
    gap: theme.spacing(1),
  }),
});
