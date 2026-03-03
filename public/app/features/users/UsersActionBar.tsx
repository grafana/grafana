import type { JSX } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { RadioButtonGroup, LinkButton, FilterInput, InlineField } from '@grafana/ui';
import { StoreState } from 'app/types/store';

import { selectTotal } from '../invites/state/selectors';

import { UsersExternalButton } from './UsersExternalButton';
import { changeSearchQuery } from './state/actions';
import { getUsersSearchQuery } from './state/selectors';
import { getCanInviteUsersToOrg } from './utils';

export interface OwnProps {
  showInvites: boolean;
  onShowInvites: () => void;
}

function mapStateToProps(state: StoreState) {
  return {
    searchQuery: getUsersSearchQuery(state.users),
    pendingInvitesCount: selectTotal(state.invites),
  };
}

const mapDispatchToProps = {
  changeSearchQuery,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = ConnectedProps<typeof connector> & OwnProps;

export const UsersActionBarUnconnected = ({
  searchQuery,
  pendingInvitesCount,
  changeSearchQuery,
  onShowInvites,
  showInvites,
}: Props): JSX.Element => {
  const options = [
    { label: t('users.users-action-bar-unconnected.options.label.users', 'Users'), value: 'users' },
    { label: `Pending Invites (${pendingInvitesCount})`, value: 'invites' },
  ];

  const onExternalUserMngClick = () => {
    reportInteraction('users_admin_actions_clicked', {
      category: 'org_users',
      item: 'manage_users_external',
    });
  };

  return (
    <div className="page-action-bar" data-testid="users-action-bar">
      <InlineField grow>
        <FilterInput
          value={searchQuery}
          onChange={changeSearchQuery}
          placeholder={t(
            'users.users-action-bar-unconnected.placeholder-search-login-email',
            'Search user by login, email or name'
          )}
        />
      </InlineField>
      {pendingInvitesCount > 0 && (
        <div style={{ marginLeft: '1rem' }}>
          <RadioButtonGroup value={showInvites ? 'invites' : 'users'} options={options} onChange={onShowInvites} />
        </div>
      )}
      {getCanInviteUsersToOrg() && (
        <LinkButton href="org/users/invite">
          <Trans i18nKey="users.users-action-bar-unconnected.invite">Invite</Trans>
        </LinkButton>
      )}
      <UsersExternalButton onExternalUserMngClick={onExternalUserMngClick} />
    </div>
  );
};

export const UsersActionBar = connector(UsersActionBarUnconnected);
