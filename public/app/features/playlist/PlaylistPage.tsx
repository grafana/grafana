import React, { FC } from 'react';
import { MapStateToProps, connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';
import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';

interface ConnectedProps {
  navModel: NavModel;
}
interface Props extends ConnectedProps, GrafanaRouteComponentProps {}

export const PlaylistPage: FC<Props> = ({ navModel }) => {
  return (
    <Page navModel={navModel}>
      <Page.Contents>Page temporarily missing, will be added back soon</Page.Contents>
    </Page>
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, {}, StoreState> = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'playlists'),
});

export default connect(mapStateToProps)(PlaylistPage);
