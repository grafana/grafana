import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { RadioButtonGroup, LinkButton, FilterInput } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, StoreState } from 'app/types';

import { selectTotal } from '../invites/state/selectors';

import { changeSearchQuery } from './state/actions';
import { getUsersSearchQuery } from './state/selectors';

export interface OwnProps {
  showInvites: boolean;
  onShowInvites: () => void;
}

function mapStateToProps(state: StoreState) {
  return {
    searchQuery: getUsersSearchQuery(state.users),
    pendingInvitesCount: selectTotal(state.invites),
    externalUserMngLinkName: state.users.externalUserMngLinkName,
    externalUserMngLinkUrl: state.users.externalUserMngLinkUrl,
    canInvite: state.users.canInvite,
  };
}

const mapDispatchToProps = {
  changeSearchQuery,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = ConnectedProps<typeof connector> & OwnProps;

export const UsersActionBarUnconnected = ({
  canInvite,
  externalUserMngLinkName,
  externalUserMngLinkUrl,
  searchQuery,
  pendingInvitesCount,
  changeSearchQuery,
  onShowInvites,
  showInvites,
}: Props): JSX.Element => {
  const options = [
    { label: 'Users', value: 'users' },
    { label: `Pending Invites (${pendingInvitesCount})`, value: 'invites' },
  ];
  const canAddToOrg: boolean = contextSrv.hasAccess(AccessControlAction.OrgUsersAdd, canInvite);

  return (
    <div className="page-action-bar" data-testid="users-action-bar">
      <div className="gf-form gf-form--grow">
        <FilterInput
          value={searchQuery}
          onChange={changeSearchQuery}
          placeholder="Search user by login, email or name"
        />
      </div>
      {pendingInvitesCount > 0 && (
        <div style={{ marginLeft: '1rem' }}>
          <RadioButtonGroup value={showInvites ? 'invites' : 'users'} options={options} onChange={onShowInvites} />
        </div>
      )}
      {canAddToOrg && <LinkButton href="org/users/invite">Invite</LinkButton>}
      {externalUserMngLinkUrl && (
        <LinkButton href={externalUserMngLinkUrl} target="_blank" rel="noopener">
          {externalUserMngLinkName}
        </LinkButton>
      )}
    </div>
  );
};

export const UsersActionBar = connector(UsersActionBarUnconnected);
