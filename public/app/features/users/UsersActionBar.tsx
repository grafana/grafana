import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames/bind';
import { setUsersSearchQuery } from './state/actions';
import { getInviteesCount, getUsersSearchQuery } from './state/selectors';

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

    const pendingInvitesButtonStyle = classNames({
      btn: true,
      'toggle-btn': true,
      active: showInvites,
    });

    const usersButtonStyle = classNames({
      btn: true,
      'toggle-btn': true,
      active: !showInvites,
    });

    return (
      <div className="page-action-bar">
        <div className="gf-form gf-form--grow">
          <label className="gf-form--has-input-icon">
            <input
              type="text"
              className="gf-form-input width-20"
              value={searchQuery}
              onChange={event => setUsersSearchQuery(event.target.value)}
              placeholder="Filter by name or type"
            />
            <i className="gf-form-input-icon fa fa-search" />
          </label>
          {pendingInvitesCount > 0 && (
            <div style={{ marginLeft: '1rem' }}>
              <button className={usersButtonStyle} key="users" onClick={onShowInvites}>
                Users
              </button>
              <button className={pendingInvitesButtonStyle} onClick={onShowInvites} key="pending-invites">
                Pending Invites ({pendingInvitesCount})
              </button>
            </div>
          )}
          <div className="page-action-bar__spacer" />
          {canInvite && (
            <a className="btn btn-success" href="org/users/invite">
              <span>Invite</span>
            </a>
          )}
          {externalUserMngLinkUrl && (
            <a className="btn btn-success" href={externalUserMngLinkUrl} target="_blank">
              <i className="fa fa-external-link-square" /> {externalUserMngLinkName}
            </a>
          )}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
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
