/*
BMC File
Author - mahmedi
*/

import { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { FilterInput, LinkButton, Pagination, VerticalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';
import { StoreState } from 'app/types';

import { PermissionListDrawer } from '../permissions/PermissionListDrawer';

import { RoleListRow } from './RoleListRow';
import { changePage, changeSearchQuery, deleteRole, loadRoles } from './state/actions';
import { initialRolesState } from './state/reducers';
import { getRoles, getSearchRoleQuery, sortedRoles } from './state/selectors';

function mapStateToProps(state: StoreState) {
  const searchQuery = getSearchRoleQuery(state.roles);
  return {
    roles: getRoles(state.roles),
    page: state.roles.page,
    searchRoleQuery: searchQuery,
    perPage: state.roles.perPage,
    totalPages: state.roles.totalCount,
    hasFetched: state.roles.hasFetched,
  };
}

const mapDispatchToProps = {
  loadRoles,
  deleteRole,
  changeSearchQuery,
  changePage,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export const RoleList = ({
  roles = initialRolesState.roles,
  page,
  searchRoleQuery,
  totalPages,
  hasFetched,
  loadRoles,
  deleteRole,
  changeSearchQuery,
  changePage,
}: Props) => {
  const params = urlUtil.getUrlSearchParams();
  const [defaultDrawer, hideDrawer] = useState<boolean>(false);
  useEffect(() => {
    if (params['roleId']) {
      hideDrawer(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadRoles(true);
  }, [loadRoles]);

  //   const canCreate = canCreateRole(editorsCanAdmin);
  //   const displayRolePicker = shouldDisplayRolePicker();
  return (
    <Page navId="roles">
      <div className="page-action-bar">
        <div className="gf-form gf-form--grow">
          <FilterInput
            placeholder={t('bmc.rbac.roles.search', 'Search roles')}
            value={searchRoleQuery}
            onChange={changeSearchQuery}
          />
        </div>
        {/* // href={canCreate ? 'org/roles/new' : '#'} disabled={!canCreate} */}
        <LinkButton href={'org/roles/new'}>
          <Trans i18nKey="bmc.rbac.roles.new">New role</Trans>
        </LinkButton>
      </div>
      <Page.Contents isLoading={!hasFetched}>
        <div className="admin-list-table">
          <VerticalGroup spacing="md">
            <table className="filter-table filter-table--hover form-inline">
              <thead>
                <tr>
                  <th>
                    <Trans i18nKey="bmc.common.name">Name</Trans>
                  </th>
                  <th style={{ width: '25%' }}>
                    <Trans i18nKey="bmc.common.type">Type</Trans>
                  </th>
                  <th style={{ width: '25%' }}>
                    <Trans i18nKey="bmc.rbac.roles.actions">Actions</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRoles(roles).map((role) => (
                  <RoleListRow key={role.id} role={role} onDelete={deleteRole} />
                ))}
              </tbody>
            </table>
            <div style={{ justifyContent: 'flex-end', width: '100%', display: 'flex' }}>
              <Pagination hideWhenSinglePage currentPage={page} numberOfPages={totalPages} onNavigate={changePage} />
            </div>
          </VerticalGroup>

          {defaultDrawer ? (
            <PermissionListDrawer
              onDismiss={() => {
                locationService.push(`roles`);
                hideDrawer(false);
              }}
              role={{ id: Number(params['roleId']), name: '', systemRole: false }}
            />
          ) : null}
        </div>
      </Page.Contents>
    </Page>
  );
};

// function canCreateRole(editorsCanAdmin: boolean): boolean {
//   const teamAdmin = contextSrv.hasRole('Admin') || (editorsCanAdmin && contextSrv.hasRole('Editor'));
//   return contextSrv.hasAccess(AccessControlAction.ActionTeamsCreate, teamAdmin);
// }

export default connector(RoleList);
