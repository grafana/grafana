import { connect, ConnectedProps } from 'react-redux';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { RadioButtonGroup, LinkButton, FilterInput, InlineField } from '@grafana/ui';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
import { StoreState } from 'app/types/store';

import { selectTotal } from '../invites/state/selectors';

import { changeSearchQuery } from './state/actions';
import { getUsersSearchQuery } from './state/selectors';
import { getExternalUserMngLinkUrl } from './utils';

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
  };
}

const mapDispatchToProps = {
  changeSearchQuery,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = ConnectedProps<typeof connector> & OwnProps;

export const UsersActionBarUnconnected = ({
  externalUserMngLinkName,
  externalUserMngLinkUrl,
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
  const canAddToOrg: boolean = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);
  // Show invite button in the following cases:
  // 1) the instance is not a hosted Grafana instance (!config.externalUserMngInfo)
  // 2) new basic auth users can be created for this instance (!config.disableLoginForm).
  const showInviteButton: boolean = canAddToOrg && !(config.disableLoginForm && config.externalUserMngInfo);

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
      {showInviteButton && (
        <LinkButton href="org/users/invite">
          <Trans i18nKey="users.users-action-bar-unconnected.invite">Invite</Trans>
        </LinkButton>
      )}
      {externalUserMngLinkUrl && (
        <LinkButton
          onClick={onExternalUserMngClick}
          href={getExternalUserMngLinkUrl('manage-users')}
          target="_blank"
          rel="noopener"
        >
          {externalUserMngLinkName}
        </LinkButton>
      )}
    </div>
  );
};

export const UsersActionBar = connector(UsersActionBarUnconnected);
