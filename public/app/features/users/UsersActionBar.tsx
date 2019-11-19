import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { setUsersSearchQuery } from './state/actions';
import { getInviteesCount, getUsersSearchQuery } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';

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
          <FilterInput
            labelClassName="gf-form--has-input-icon"
            inputClassName="gf-form-input width-20"
            value={searchQuery}
            onChange={setUsersSearchQuery}
            placeholder="Filter by name or type"
          />
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
            <a className="btn btn-primary" href="org/users/invite">
              <span>Invite</span>
            </a>
          )}
          {externalUserMngLinkUrl && (
            <a className="btn btn-primary" href={externalUserMngLinkUrl} target="_blank" rel="noopener">
              {externalUserMngLinkName}
            </a>
          )}
        </div>
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

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UsersActionBar);
