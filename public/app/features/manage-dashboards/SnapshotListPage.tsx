import React, { FC } from 'react';
import { MapStateToProps, connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';
import { SnapshotListTable } from './components/SnapshotListTable';
import { getDashboardNavModel } from './state/selectors';
import { GrafanaRouteComponentProps } from '../../core/navigation/types';

interface ConnectedProps {
  navModel: NavModel;
}
interface Props extends ConnectedProps, GrafanaRouteComponentProps {}

export const SnapshotListPage: FC<Props> = ({ navModel, location }) => {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <SnapshotListTable />
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, {}, StoreState> = (state: StoreState) => ({
  navModel: getDashboardNavModel(state),
});

export default connect(mapStateToProps)(SnapshotListPage);
