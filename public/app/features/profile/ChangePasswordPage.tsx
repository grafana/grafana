import React from 'react';
import { hot } from 'react-hot-loader';
import { connect, ConnectedProps } from 'react-redux';
import { StoreState } from 'app/types';
import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { ChangePasswordForm } from './ChangePasswordForm';
import { changePassword, loadUser } from './state/actions';
import { useAsync } from 'react-use';

export interface OwnProps {
  navModel: NavModel;
}

function mapStateToProps(state: StoreState) {
  const userState = state.user;
  const { loadingUser, updating, user } = userState;
  return {
    navModel: getNavModel(state.navIndex, `change-password`),
    loadingUser,
    updating,
    user,
  };
}

const mapDispatchToProps = {
  loadUser,
  changePassword,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

export function ChangePasswordPage({ navModel, loadUser, loadingUser, updating, user, changePassword }: Props) {
  useAsync(async () => {
    await loadUser();
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={loadingUser || !Boolean(user)}>
        <h3 className="page-heading">Change Your Password</h3>
        <ChangePasswordForm user={user!} onChangePassword={changePassword} isSaving={updating} />
      </Page.Contents>
    </Page>
  );
}

export default hot(module)(connector(ChangePasswordPage));
