import React, { FC } from 'react';
import { MapStateToProps, connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import { getUrl } from 'app/core/selectors/location';
import { StoreState } from 'app/types';
import { SnapshotListTable } from './components/SnapshotListTable';
import { getDashboardNavModel } from './state/selectors';

interface Props {
  navModel: NavModel;
  url: string;
}

export const SnapshotListPage: FC<Props> = ({ navModel, url }) => {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <SnapshotListTable url={url} />
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps: MapStateToProps<Props, {}, StoreState> = (state: StoreState) => ({
  navModel: getDashboardNavModel(state),
  url: getUrl(state.location),
});

export default connect(mapStateToProps)(SnapshotListPage);
