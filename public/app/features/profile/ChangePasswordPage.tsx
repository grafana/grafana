import React, { FC } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { config } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';
import { UserDTO, Team, UserOrg, UserSession, StoreState } from 'app/types';
import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { UserProvider, UserAPI, LoadingStates } from 'app/core/utils/UserProvider';
import Page from 'app/core/components/Page/Page';
import { ChangePasswordForm } from './ChangePasswordForm';

export interface Props {
  navModel: NavModel;
}

export const ChangePasswordPage: FC<Props> = ({ navModel }) => (
  <Page navModel={navModel}>
    <UserProvider userId={config.bootData.user.id}>
      {(
        api: UserAPI,
        states: LoadingStates,
        teams: Team[],
        orgs: UserOrg[],
        sessions: UserSession[],
        user?: UserDTO
      ) => {
        return (
          <Page.Contents>
            <h3 className="page-sub-heading">Change Your Password</h3>
            {states.loadUser ? (
              <LoadingPlaceholder text="Loading user profile..." />
            ) : (
              <ChangePasswordForm user={user!} onChangePassword={api.changePassword} isSaving={states.changePassword} />
            )}
          </Page.Contents>
        );
      }}
    </UserProvider>
  </Page>
);

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, `change-password`),
  };
}

const mapDispatchToProps = {};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(ChangePasswordPage));
