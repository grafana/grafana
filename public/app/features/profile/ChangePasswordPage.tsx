import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useMount } from 'react-use';

import { NavModel } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

import { ChangePasswordForm } from './ChangePasswordForm';
import { changePassword, loadUser } from './state/actions';

export interface OwnProps {
  navModel: NavModel;
}

function mapStateToProps(state: StoreState) {
  const userState = state.user;
  const { isUpdating, user } = userState;
  return {
    navModel: getNavModel(state.navIndex, `change-password`),
    isUpdating,
    user,
  };
}

const mapDispatchToProps = {
  loadUser,
  changePassword,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export function ChangePasswordPage({ navModel, loadUser, isUpdating, user, changePassword }: Props) {
  useMount(() => loadUser());

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={!Boolean(user)}>
        {user ? (
          <>
            <h3 className="page-heading">Change Your Password</h3>
            <ChangePasswordForm user={user} onChangePassword={changePassword} isSaving={isUpdating} />
          </>
        ) : null}
      </Page.Contents>
    </Page>
  );
}

export default connector(ChangePasswordPage);
