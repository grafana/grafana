import { cloneDeep } from 'lodash';
import { FC, useEffect, useState } from 'react';

import { contextSrv } from 'app/core/core';
import { initialState } from 'app/core/reducers/navBarTree';
import { updateNavIndex } from 'app/core/reducers/navModel';
import { fetchFolders } from 'app/features/manage-dashboards/state/actions';
import { updateNavTree } from 'app/percona/shared/core/reducers/navigation';
import { fetchActiveServiceTypesAction } from 'app/percona/shared/core/reducers/services';
import { useAppDispatch } from 'app/store/store';
import { FolderDTO, useSelector } from 'app/types';

import { getCategorizedAdvisors, getPerconaSettings, getPerconaUser, getServices } from '../../../core/selectors';

import {
  ACTIVE_SERVICE_TYPES_CHECK_INTERVAL_MS,
  getPmmSettingsPage,
  PMM_NAV_QAN,
  PMM_ACCESS_ROLES_PAGE,
  PMM_ACCESS_ROLE_CREATE_PAGE,
  PMM_ACCESS_ROLE_EDIT_PAGE,
  PMM_ADD_INSTANCE_PAGE,
  PMM_BACKUP_PAGE,
  PMM_EDIT_INSTANCE_PAGE,
  PMM_ENTITLEMENTS_PAGE,
  PMM_ENVIRONMENT_OVERVIEW_PAGE,
  PMM_INVENTORY_PAGE,
  PMM_TICKETS_PAGE,
  PMM_DUMP_PAGE,
} from './PerconaNavigation.constants';
import {
  addAccessRolesLink,
  addDashboardsLinks,
  addFolderLinks,
  buildAdvisorsNavItem,
  buildIntegratedAlertingMenuItem,
  buildInventoryAndSettings,
  filterByServices,
  removeAlertingMenuItem,
  sortNavigation,
} from './PerconaNavigation.utils';

const PerconaNavigation: FC = () => {
  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const { result } = useSelector(getPerconaSettings);
  const { alertingEnabled, advisorEnabled, backupEnabled } = result || {};
  const { isPlatformUser, isAuthorized } = useSelector(getPerconaUser);
  const categorizedAdvisors = useSelector(getCategorizedAdvisors);
  const isLoggedIn = !!contextSrv.user.isSignedIn;
  const dispatch = useAppDispatch();
  const { activeTypes } = useSelector(getServices);
  const advisorsPage = buildAdvisorsNavItem(categorizedAdvisors);

  dispatch(updateNavIndex(getPmmSettingsPage(alertingEnabled)));
  dispatch(updateNavIndex(PMM_DUMP_PAGE));
  dispatch(updateNavIndex(PMM_BACKUP_PAGE));
  dispatch(updateNavIndex(PMM_INVENTORY_PAGE));
  dispatch(updateNavIndex(PMM_ADD_INSTANCE_PAGE));
  dispatch(updateNavIndex(PMM_EDIT_INSTANCE_PAGE));
  dispatch(updateNavIndex(PMM_TICKETS_PAGE));
  dispatch(updateNavIndex(PMM_ENTITLEMENTS_PAGE));
  dispatch(updateNavIndex(PMM_ENVIRONMENT_OVERVIEW_PAGE));
  dispatch(updateNavIndex(PMM_ACCESS_ROLE_CREATE_PAGE));
  dispatch(updateNavIndex(PMM_ACCESS_ROLE_EDIT_PAGE));
  dispatch(updateNavIndex(advisorsPage));

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isLoggedIn) {
      fetchFolders().then(setFolders);
      dispatch(fetchActiveServiceTypesAction());

      interval = setInterval(() => {
        dispatch(fetchActiveServiceTypesAction());
      }, ACTIVE_SERVICE_TYPES_CHECK_INTERVAL_MS);
    }

    return () => clearInterval(interval);
  }, [dispatch, isLoggedIn]);

  useEffect(() => {
    const updatedNavTree = cloneDeep(initialState);

    // Add Dashboards
    addDashboardsLinks(updatedNavTree);

    // QAN
    updatedNavTree.push(PMM_NAV_QAN);

    if (isPlatformUser) {
      updatedNavTree.push(PMM_ENTITLEMENTS_PAGE);
      updatedNavTree.push(PMM_TICKETS_PAGE);
      updatedNavTree.push(PMM_ENVIRONMENT_OVERVIEW_PAGE);
    }

    // PMM Dump
    const help = updatedNavTree.find((i) => i.id === 'help');
    if (help) {
      help.children?.push(PMM_DUMP_PAGE);
      dispatch(updateNavIndex(help));
    }

    if (isAuthorized) {
      if (result?.enableAccessControl) {
        const cfg = cloneDeep(initialState).find((i) => i.id === 'cfg');

        // update nav index with the access roles tab
        if (cfg) {
          addAccessRolesLink(cfg);
          dispatch(updateNavIndex(PMM_ACCESS_ROLES_PAGE));
          dispatch(updateNavIndex(cfg));
        }
      }

      buildInventoryAndSettings(updatedNavTree, result);

      const iaMenuItem = alertingEnabled
        ? buildIntegratedAlertingMenuItem(updatedNavTree)
        : removeAlertingMenuItem(updatedNavTree);

      if (iaMenuItem) {
        dispatch(updateNavIndex(iaMenuItem));
      }

      if (advisorEnabled) {
        updatedNavTree.push(advisorsPage);
      }

      if (backupEnabled) {
        updatedNavTree.push(PMM_BACKUP_PAGE);
      }
    } else {
      dispatch(updateNavIndex(PMM_ACCESS_ROLES_PAGE));
    }

    addFolderLinks(updatedNavTree, folders);

    sortNavigation(updatedNavTree);

    dispatch(updateNavTree(filterByServices(updatedNavTree, activeTypes)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, folders, activeTypes, isAuthorized, isPlatformUser, advisorsPage]);

  return null;
};

export default PerconaNavigation;
