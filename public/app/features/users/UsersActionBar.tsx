import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { setUsersSearchQuery } from './state/actions';
import { getInviteesCount, getUsersSearchQuery } from './state/selectors';

export interface Props {
  searchQuery: string;
  setUsersSearchQuery: typeof setUsersSearchQuery;
  onShowInvites: () => void;
  pendingInvitesCount: number;
  canInvite: boolean;
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
    } = this.props;

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

          <div className="page-action-bar__spacer" />
          {pendingInvitesCount > 0 && (
            <button className="btn btn-inverse" onClick={onShowInvites}>
              Pending Invites ({pendingInvitesCount})
            </button>
          )}
          {canInvite && (
            <a className="btn btn-success" href="org/users/invite">
              <i className="fa fa-plus" />
              <span>Invite</span>
            </a>
          )}
          {externalUserMngLinkUrl && (
            <a className="btn btn-success" href={externalUserMngLinkUrl} target="_blank">
              <i className="fa fa-external-link-square" />
              {externalUserMngLinkName}
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
