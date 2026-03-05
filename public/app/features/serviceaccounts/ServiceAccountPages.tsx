import { createSelector } from '@reduxjs/toolkit';
import { memo, useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModel } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

import { ServiceAccountInformationPage } from './ServiceAccountInformationPage';
import { ServiceAccountManagementPage } from './ServiceAccountManagementPage';
import { ServiceAccountRolesPage } from './ServiceAccountRolesPage';
import { ServiceAccountTokensPage } from './ServiceAccountTokensPage';
import { fetchACOptions } from './state/actions';
import { loadServiceAccount } from './state/actionsServiceAccountPage';
import { buildNavModel } from './state/buildNavModel';

type ServiceAccountPageRouteParams = {
  uid: string;
  page?: string;
};

enum PageTypes {
  Information = 'information',
  Tokens = 'tokens',
  Management = 'management',
  Roles = 'roles',
}

function getPageType(page: string | undefined): PageTypes {
  switch (page) {
    case PageTypes.Tokens:
      return PageTypes.Tokens;
    case PageTypes.Management:
      return PageTypes.Management;
    case PageTypes.Roles:
      return PageTypes.Roles;
    case PageTypes.Information:
    default:
      return PageTypes.Information;
  }
}

// Create a loading nav model for when service account is not yet loaded
function getLoadingNavModel(uid: string): NavModel {
  const navModel = buildNavModel(null, uid);
  return {
    main: navModel,
    node: navModel,
  };
}

const pageNavSelector = createSelector(
  [
    (state: StoreState) => state.navIndex,
    (state: StoreState) => state.serviceAccountProfile.serviceAccount,
    (_state: StoreState, uid: string) => uid,
    (_state: StoreState, _uid: string, currentPage: PageTypes) => currentPage,
  ],
  (navIndex, serviceAccount, uid, currentPage) => {
    if (!serviceAccount) {
      return getLoadingNavModel(uid);
    }

    const navModel = buildNavModel(serviceAccount, uid);
    const activeTab = navModel.children?.find((child) => child.id === `serviceaccount-${currentPage}-${uid}`);

    if (activeTab) {
      activeTab.active = true;
    }

    return getNavModel(navIndex, `serviceaccount-${currentPage}-${uid}`, {
      main: navModel,
      node: activeTab || navModel,
    });
  }
);

const ServiceAccountPages = memo(() => {
  const dispatch = useDispatch();
  const { uid = '', page } = useParams<ServiceAccountPageRouteParams>();

  const serviceAccount = useSelector((state) => state.serviceAccountProfile.serviceAccount);
  const isLoading = useSelector((state) => state.serviceAccountProfile.isLoading);
  const currentPage = getPageType(page);
  const pageNav = useSelector((state) => pageNavSelector(state, uid, currentPage));

  useEffect(() => {
    dispatch(loadServiceAccount(uid));
    if (contextSrv.licensedAccessControlEnabled()) {
      dispatch(fetchACOptions());
    }
  }, [dispatch, uid]);

  const renderPage = () => {
    if (!serviceAccount) {
      return null;
    }

    const canReadPermissions = contextSrv.hasPermissionInMetadata(
      AccessControlAction.ServiceAccountsPermissionsRead,
      serviceAccount
    );

    switch (currentPage) {
      case PageTypes.Information:
        return <ServiceAccountInformationPage serviceAccount={serviceAccount} />;
      case PageTypes.Tokens:
        return <ServiceAccountTokensPage serviceAccount={serviceAccount} />;
      case PageTypes.Management:
        if (!serviceAccount.isExternal && canReadPermissions) {
          return <ServiceAccountManagementPage serviceAccount={serviceAccount} />;
        }
        return null;
      case PageTypes.Roles:
        if (contextSrv.licensedAccessControlEnabled()) {
          return <ServiceAccountRolesPage serviceAccount={serviceAccount} />;
        }
        return null;
      default:
        return <ServiceAccountInformationPage serviceAccount={serviceAccount} />;
    }
  };

  return (
    <Page navId="serviceaccounts" pageNav={pageNav.main}>
      <Page.Contents isLoading={isLoading}>{serviceAccount && renderPage()}</Page.Contents>
    </Page>
  );
});

ServiceAccountPages.displayName = 'ServiceAccountPages';

export default ServiceAccountPages;
