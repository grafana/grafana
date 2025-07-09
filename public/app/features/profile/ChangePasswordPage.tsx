import { connect, ConnectedProps } from 'react-redux';
import { useMount } from 'react-use';

import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types/store';

import { ChangePasswordForm } from './ChangePasswordForm';
import { changePassword, loadUser } from './state/actions';

export interface OwnProps {}

function mapStateToProps(state: StoreState) {
  const userState = state.user;
  const { isUpdating, user } = userState;
  return {
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

export function ChangePasswordPage({ loadUser, isUpdating, user, changePassword }: Props) {
  useMount(() => loadUser());

  return (
    <Page navId="profile/password">
      <Page.Contents isLoading={!Boolean(user)}>
        {user ? (
          <>
            <ChangePasswordForm user={user} onChangePassword={changePassword} isSaving={isUpdating} />
          </>
        ) : null}
      </Page.Contents>
    </Page>
  );
}

export default connector(ChangePasswordPage);
