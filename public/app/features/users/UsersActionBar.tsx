import { css } from '@emotion/css';
import { t } from 'i18next';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { RadioButtonGroup, LinkButton, FilterInput, MultiSelect, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, StoreState } from 'app/types';

import { selectTotal } from '../invites/state/selectors';
import { changeFilter } from '../users/state/actions';

import { changeSearchQuery, loadUsers } from './state/actions';
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
    filters: state.users.filters,
  };
}

const mapDispatchToProps = {
  changeSearchQuery,
  changeFilter,
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
  changeFilter,
  filters,
}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  const options = [
    { label: t('users-action-bar.options-users', 'Users'), value: 'users' },
    { label: t('users-action-bar.pending-invites', `Pending Invites (${pendingInvitesCount})`), value: 'invites' },
  ];
  const canAddToOrg: boolean = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);
  // Show invite button in the following cases:
  // 1) the instance is not a hosted Grafana instance (!config.externalUserMngInfo)
  // 2) new basic auth users can be created for this instance (!config.disableLoginForm).
  const showInviteButton: boolean = canAddToOrg && !(config.disableLoginForm && config.externalUserMngInfo);

  const selectedRoles =
    (filters.find((f) => f.name === 'role')?.value as Array<SelectableValue<string>> | undefined) || [];

  const onRoleFilterChange = (selected: Array<SelectableValue<string>>) => {
    const roles: Array<SelectableValue<string>> = selected
      .map((role): SelectableValue<string> | null => {
        if (role && typeof role === 'object' && 'value' in role && role.value !== undefined) {
          return { label: role.label, value: role.value };
        }
        return null;
      })
      .filter((role): role is SelectableValue<string> => role !== null);

    const uniqueRoles = Array.from(new Map(roles.map((item) => [item.value, item])).values());

    changeFilter({ name: 'role', value: uniqueRoles });

    loadUsers();
  };

  return (
    <div className={styles.actionBar} data-testid="users-action-bar">
      <div className={styles.row}>
        <FilterInput
          value={searchQuery}
          onChange={changeSearchQuery}
          placeholder={t('users-action-bar.search-placeholder', 'Search user by login, email or name')}
          className={styles.queryInput}
        />

        <MultiSelect
          options={[]}
          value={selectedRoles}
          placeholder={t('users-action-bar.filter-role', 'Filter by role')}
          allowCustomValue={true}
          onCreateOption={(inputValue) => {
            const newRole: SelectableValue<string> = { label: inputValue, value: inputValue };
            onRoleFilterChange([...selectedRoles, newRole]);
          }}
          onChange={onRoleFilterChange}
          className={styles.filter}
        />

        {pendingInvitesCount > 0 && (
          <div style={{ marginLeft: '1rem' }}>
            <RadioButtonGroup value={showInvites ? 'invites' : 'users'} options={options} onChange={onShowInvites} />
          </div>
        )}

        {/* Invite and external management links */}
        {showInviteButton && <LinkButton href="org/users/invite">{t('users-action-bar.invite', 'Invite')}</LinkButton>}
        {externalUserMngLinkUrl && (
          <LinkButton href={externalUserMngLinkUrl} target="_blank" rel="noopener">
            {t(externalUserMngLinkName)}
          </LinkButton>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    filter: css({
      margin: theme.spacing(0, 1),
      [theme.breakpoints.down('sm')]: {
        margin: 0,
      },
    }),
    queryInput: css({
      flexGrow: 1,
      minWidth: '70%',
    }),
    actionBar: css({
      marginBottom: theme.spacing(2),
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(2),
      [theme.breakpoints.down('sm')]: {
        flexWrap: 'wrap',
      },
    }),
    row: css({
      display: 'flex',
      alignItems: 'flex-start',
      textAlign: 'left',
      marginBottom: theme.spacing(0.5),
      flexGrow: 1,

      [theme.breakpoints.down('sm')]: {
        flexWrap: 'wrap',
        gap: theme.spacing(2),
        width: '100%',
      },
    }),
  };
};

export const UsersActionBar = connector(UsersActionBarUnconnected);
