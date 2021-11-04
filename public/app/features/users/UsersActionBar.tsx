import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { setUsersSearchQuery } from './state/reducers';
import { getInviteesCount, getUsersSearchQuery } from './state/selectors';
import { RadioButtonGroup, LinkButton, FilterInput } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

export interface Props {
  searchQuery: string;
  setUsersSearchQuery: typeof setUsersSearchQuery;
  onShowInvites: () => void;
  pendingInvitesCount: number;
  canInvite: boolean;
  showInvites: boolean;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
}

export class UsersActionBar extends PureComponent<Props> {
  render() {
    const {
      canInvite,
      externalUserMngLinkName,
      externalUserMngLinkUrl,
      searchQuery,
      pendingInvitesCount,
      setUsersSearchQuery,
      onShowInvites,
      showInvites,
    } = this.props;
    const options = [
      { label: 'Users', value: 'users' },
      { label: `Pending Invites (${pendingInvitesCount})`, value: 'invites' },
    ];
    const canAddToOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);

    return (
      <div className="page-action-bar">
        <div className="gf-form gf-form--grow">
          <FilterInput
            value={searchQuery}
            onChange={setUsersSearchQuery}
            placeholder="Search user by login, email or name"
          />
        </div>
        {pendingInvitesCount > 0 && (
          <div style={{ marginLeft: '1rem' }}>
            <RadioButtonGroup value={showInvites ? 'invites' : 'users'} options={options} onChange={onShowInvites} />
          </div>
        )}
        {canInvite && canAddToOrg && <LinkButton href="org/users/invite">Invite</LinkButton>}
        {externalUserMngLinkUrl && (
          <LinkButton href={externalUserMngLinkUrl} target="_blank" rel="noopener">
            {externalUserMngLinkName}
          </LinkButton>
        )}
      </div>
    );
  }
}

function mapStateToProps(state: any) {
  return {
    searchQuery: getUsersSearchQuery(state.users),
    pendingInvitesCount: getInviteesCount(state.users),
    externalUserMngLinkName: state.users.externalUserMngLinkName,
    externalUserMngLinkUrl: state.users.externalUserMngLinkUrl,
    canInvite: state.users.canInvite,
  };
}

const mapDispatchToProps = {
  setUsersSearchQuery,
};

export default connect(mapStateToProps, mapDispatchToProps)(UsersActionBar);
