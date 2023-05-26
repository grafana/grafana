import { css } from '@emotion/css';
import React, { memo } from 'react';
import { useAsync } from 'react-use';

import { locationUtil, NavModelItem } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import NewBrowseDashboardsPage from 'app/features/browse-dashboards/BrowseDashboardsPage';
import { FolderDTO } from 'app/types';

import { loadFolderPage } from '../loaders';

import ManageDashboardsNew from './ManageDashboardsNew';

export interface DashboardListPageRouteParams {
  uid?: string;
  slug?: string;
}

interface Props extends GrafanaRouteComponentProps<DashboardListPageRouteParams> {}

export const DashboardListPageFeatureToggle = memo((props: Props) => {
  if (config.featureToggles.nestedFolders) {
    return <NewBrowseDashboardsPage {...props} />;
  }

  return <DashboardListPage {...props} />;
});
DashboardListPageFeatureToggle.displayName = 'DashboardListPageFeatureToggle';

const DashboardListPage = memo(({ match, location }: Props) => {
  const { loading, value } = useAsync<() => Promise<{ folder?: FolderDTO; pageNav?: NavModelItem }>>(() => {
    const uid = match.params.uid;
    const url = location.pathname;

    if (!uid || !url.startsWith('/dashboards')) {
      return Promise.resolve({});
    }

    return loadFolderPage(uid!).then(({ folder, folderNav }) => {
      const path = locationUtil.stripBaseFromUrl(folder.url);

      if (path !== location.pathname) {
        locationService.replace(path);
      }

      return { folder, pageNav: folderNav };
    });
  }, [match.params.uid]);

  return (
    <Page navId="dashboards/browse" pageNav={value?.pageNav}>
      <Page.Contents
        isLoading={loading}
        className={css`
          display: flex;
          flex-direction: column;
          height: 100%;
        `}
      >
        <ManageDashboardsNew folder={value?.folder} />
      </Page.Contents>
    </Page>
  );
});

DashboardListPage.displayName = 'DashboardListPage';

export default DashboardListPageFeatureToggle;
