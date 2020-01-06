import React, { FunctionComponent, useContext } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, ThemeContext } from '@grafana/ui';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { setUsersSearchQuery } from './state/reducers';
import { getInviteesCount, getUsersSearchQuery } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  btn: css`
    background: ${theme.colors.primary};

    &:hover {
      background: ${theme.colors.primaryHover};
    }
  `,
}));

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

export const UsersActionBar: FunctionComponent<Props> = (props: Props) => {
  const {
    canInvite,
    externalUserMngLinkName,
    externalUserMngLinkUrl,
    searchQuery,
    pendingInvitesCount,
    setUsersSearchQuery,
    onShowInvites,
    showInvites,
  } = props;
  const theme = useContext(ThemeContext);
  const style = getStyles(theme);

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
          placeholder="Filter by email, login or name"
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
          <a className={cx('btn', 'btn-primary', style.btn)} href="org/users/invite">
            <span>Invite</span>
          </a>
        )}
        {externalUserMngLinkUrl && (
          <a
            className={cx('btn', 'btn-primary', style.btn)}
            href={externalUserMngLinkUrl}
            target="_blank"
            rel="noopener"
          >
            {externalUserMngLinkName}
          </a>
        )}
      </div>
    </div>
  );
};

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
