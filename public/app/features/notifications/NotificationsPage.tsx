import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Page } from 'app/core/components/Page/Page';

import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { getNavModel } from '../../core/selectors/navModel';
import { StoreState } from '../../types';

import { StoredNotifications } from './StoredNotifications';

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'notifications'),
});

const connector = connect(mapStateToProps, undefined);

interface OwnProps extends GrafanaRouteComponentProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

export const NotificationsPage = ({ navModel }: Props) => {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <StoredNotifications />
      </Page.Contents>
    </Page>
  );
};

export default connect(mapStateToProps)(NotificationsPage);
