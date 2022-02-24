import React, { FC } from 'react';
import { connect } from 'react-redux';
import UserInviteForm from './UserInviteForm';
import { contextSrv } from 'app/core/core';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types/store';
import Page from 'app/core/components/Page/Page';
import { NavModel } from '@grafana/data';

interface Props {
  navModel: NavModel;
}

export const UserInvitePage: FC<Props> = ({ navModel }) => {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h3 className="page-sub-heading">Invite user</h3>
        <div className="p-b-2">
          Send invitation or add existing Grafana user to the organization.
          <span className="highlight-word"> {contextSrv.user.orgName}</span>
        </div>
        <UserInviteForm />
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'users'),
});

export default connect(mapStateToProps)(UserInvitePage);
