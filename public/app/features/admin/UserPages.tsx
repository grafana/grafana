import { createSelector } from '@reduxjs/toolkit';
import { memo, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModel } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

import { UserInformationPage } from './UserInformationPage';
import { deleteUser, loadAdminUserPage } from './state/actions';
import { buildUserNavModel } from './state/buildUserNavModel';

type UserPageRouteParams = {
  uid: string;
  page?: string;
};

enum PageTypes {
  Information = 'information',
  Roles = 'roles',
}

function getPageType(page: string | undefined): PageTypes {
  switch (page) {
    case PageTypes.Roles:
      return PageTypes.Roles;
    case PageTypes.Information:
    default:
      return PageTypes.Information;
  }
}

// Create a loading nav model for when user is not yet loaded
function getLoadingNavModel(uid: string): NavModel {
  const navModel = buildUserNavModel(null, uid);
  return {
    main: navModel,
    node: navModel,
  };
}

const pageNavSelector = createSelector(
  [
    (state: StoreState) => state.navIndex,
    (state: StoreState) => state.userAdmin.user,
    (_state: StoreState, uid: string) => uid,
    (_state: StoreState, _uid: string, currentPage: PageTypes) => currentPage,
  ],
  (navIndex, user, uid, currentPage) => {
    if (!user) {
      return getLoadingNavModel(uid);
    }

    const navModel = buildUserNavModel(user, uid);
    const activeTab = navModel.children?.find((child) => child.id === `user-${currentPage}-${uid}`);

    if (activeTab) {
      activeTab.active = true;
    }

    return getNavModel(navIndex, `user-${currentPage}-${uid}`, {
      main: navModel,
      node: activeTab || navModel,
    });
  }
);

const UserPages = memo(() => {
  const dispatch = useDispatch();
  const { uid = '', page } = useParams<UserPageRouteParams>();

  const user = useSelector((state) => state.userAdmin.user);
  const isLoading = useSelector((state) => state.userAdmin.isLoading);
  const currentPage = getPageType(page);
  const pageNav = useSelector((state) => pageNavSelector(state, uid, currentPage));

  useEffect(() => {
    dispatch(loadAdminUserPage(uid));
  }, [dispatch, uid]);

  const handleUserDelete = useCallback(
    (userUid: string) => {
      dispatch(deleteUser(userUid));
    },
    [dispatch]
  );

  const renderPage = () => {
    if (!user) {
      return null;
    }

    switch (currentPage) {
      case PageTypes.Information:
        return <UserInformationPage user={user} onUserDelete={handleUserDelete} />;
      case PageTypes.Roles:
        // Roles tab content ships in UI PR 1
        return (
          <Alert severity="info" title="Coming soon">
            <Trans i18nKey="admin.user-pages.roles-placeholder">
              Role management will be available here.
            </Trans>
          </Alert>
        );
      default:
        return <UserInformationPage user={user} onUserDelete={handleUserDelete} />;
    }
  };

  return (
    <Page navId="global-users" pageNav={pageNav.main}>
      <Page.Contents isLoading={isLoading}>{user && renderPage()}</Page.Contents>
    </Page>
  );
});

UserPages.displayName = 'UserPages';

export default UserPages;
