import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Dropdown, FilterInput, IconButton, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { StoreState } from 'app/types';

import { changeSearchQuery, changeTeamFilter } from './state/actions';
import { getTeamFilters, getTeamsSearchQuery } from './state/selectors';

function mapStateToProps(state: StoreState) {
  return {
    searchQuery: getTeamsSearchQuery(state.rbacTeams),
  };
}

const mapDispatchToProps = {
  changeSearchQuery,
  changeTeamFilter,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = { roleId: number; selectedCount: number | undefined } & ConnectedProps<typeof connector>;

export const TeamsActionBarUnconnected = ({
  roleId,
  selectedCount,
  searchQuery,
  changeSearchQuery,
  changeTeamFilter,
}: Props): JSX.Element => {
  const TEAM_FILTER = useMemo(() => {
    return getTeamFilters();
  }, []);

  const [teamFilter, setTeamFilter] = useState<string>(TEAM_FILTER.all.value);

  const teamFilterChanged = (filterValue: string) => {
    setTeamFilter(filterValue);
    changeTeamFilter(filterValue, roleId);
  };

  const ActionMenu = ({
    changeFilter,
    currentFilter,
  }: {
    changeFilter: (filter: string) => void;
    currentFilter: string;
  }) => {
    const isFilterAll = currentFilter === TEAM_FILTER.all.value;
    const menu = (
      <Menu>
        <Menu.Item
          label={TEAM_FILTER.all.label}
          onClick={() => changeFilter(TEAM_FILTER.all.value)}
          active={isFilterAll}
          icon={isFilterAll ? 'check-circle' : 'circle'}
        />
        <Menu.Item
          label={TEAM_FILTER.assigned.label}
          onClick={() => changeFilter(TEAM_FILTER.assigned.value)}
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
    <div className="page-action-bar" data-testid="teams-action-bar">
      <div className="gf-form gf-form--grow">
        <FilterInput
          value={searchQuery}
          onChange={(val) => changeSearchQuery(val, roleId)}
          placeholder={t('bmc.rbac.teams.search', 'Search team name')}
        />
        <ActionMenu changeFilter={teamFilterChanged} currentFilter={teamFilter}></ActionMenu>
      </div>
    </div>
  );
};

export const TeamsActionBar = connector(TeamsActionBarUnconnected);
