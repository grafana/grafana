import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Dropdown, FilterInput, IconButton, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { StoreState } from 'app/types';

import { changeSearchQuery, changeUserFilter } from './state/actions';
import { getUserFilters, getUsersSearchQuery } from './state/selectors';

function mapStateToProps(state: StoreState) {
  return {
    searchQuery: getUsersSearchQuery(state.rbacUsers),
  };
}

const mapDispatchToProps = {
  changeSearchQuery,
  changeUserFilter,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = { roleId: number; selectedCount: number | undefined } & ConnectedProps<typeof connector>;

export const UsersActionBarUnconnected = ({
  roleId,
  selectedCount,
  searchQuery,
  changeSearchQuery,
  changeUserFilter,
}: Props): JSX.Element => {
  const USER_FILTER = useMemo(() => {
    return getUserFilters();
  }, []);

  const [userFilter, setUserFilter] = useState<string>(USER_FILTER.all.value);

  const userFilterChanged = (filterValue: string) => {
    setUserFilter(filterValue);
    changeUserFilter(filterValue, roleId);
  };

  const ActionMenu = ({
    changeFilter,
    currentFilter,
  }: {
    changeFilter: (filter: string) => void;
    currentFilter: string;
  }) => {
    const isFilterAll = currentFilter === USER_FILTER.all.value;
    const menu = (
      <Menu>
        <Menu.Item
          label={USER_FILTER.all.label}
          onClick={() => changeFilter(USER_FILTER.all.value)}
          active={isFilterAll}
          icon={isFilterAll ? 'check-circle' : 'circle'}
        />
        <Menu.Item
          label={USER_FILTER.assigned.label}
          onClick={() => changeFilter(USER_FILTER.assigned.value)}
          active={!isFilterAll}
          icon={!isFilterAll ? 'check-circle' : 'circle'}
          disabled={!selectedCount}
        />
      </Menu>
    );

    return (
      <div
        className={css`
          margin: 4px;
        `}
      >
        <Dropdown overlay={menu}>
          <IconButton title={t('bmc.rbac.common.menu', 'Menu')} name="filter" size="xl" aria-label="" />
        </Dropdown>
      </div>
    );
  };

  return (
    <div className="page-action-bar" data-testid="users-action-bar">
      <div className="gf-form gf-form--grow">
        <FilterInput
          value={searchQuery}
          onChange={(val) => changeSearchQuery(val, roleId)}
          placeholder={t(
            'bmcgrafana.users-and-access.search-user-placeholder-text',
            'Search user by login, email or name'
          )}
        />
        <ActionMenu changeFilter={userFilterChanged} currentFilter={userFilter}></ActionMenu>
      </div>
    </div>
  );
};

export const UsersActionBar = connector(UsersActionBarUnconnected);
