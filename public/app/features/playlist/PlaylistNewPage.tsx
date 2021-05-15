import React, { FC } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';
import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { PlaylistForm } from './PlaylistForm';
import { createPlaylist } from './api';
import { Playlist } from './types';
import { usePlaylist } from './usePlaylist';
import { getPlaylistStyles } from './styles';

interface ConnectedProps {
  navModel: NavModel;
}

interface Props extends ConnectedProps, GrafanaRouteComponentProps {}

export const PlaylistNewPage: FC<Props> = ({ navModel }) => {
  const styles = useStyles2(getPlaylistStyles);
  const { playlist, loading } = usePlaylist();
  const onSubmit = async (playlist: Playlist) => {
    await createPlaylist(playlist);
    locationService.push('/playlists');
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={loading}>
        <h3 className={styles.subHeading}>New Playlist</h3>

        <p className={styles.description}>
          A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build
          situational awareness, or just show off your metrics to your team or visitors.
        </p>

        <PlaylistForm onSubmit={onSubmit} playlist={playlist} />
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, {}, StoreState> = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'playlists'),
});

export default connect(mapStateToProps)(PlaylistNewPage);
