import React, { FC, memo } from 'react';
import { useAsync } from 'react-use';
import { connect, MapStateToProps } from 'react-redux';
import { NavModel, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { FolderDTO, StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { loadFolderPage } from '../loaders';
import ManageDashboards from './ManageDashboards';
import { GrafanaRouteComponentProps } from '../../../core/navigation/types';

export interface DashboardListPageRouteParams {
  uid?: string;
  slug?: string;
}

interface DashboardListPageConnectedProps {
  navModel: NavModel;
}
interface Props extends GrafanaRouteComponentProps<DashboardListPageRouteParams>, DashboardListPageConnectedProps {}

export const DashboardListPage: FC<Props> = memo(({ navModel, match, location }) => {
  const { loading, value } = useAsync<() => Promise<{ folder?: FolderDTO; pageNavModel: NavModel }>>(() => {
    const uid = match.params.uid;
    const url = location.pathname;
    if (!uid || !url.startsWith('/dashboards')) {
      return Promise.resolve({ pageNavModel: navModel });
    }

    return loadFolderPage(uid!).then(({ folder, folderNav }) => {
      const path = locationUtil.stripBaseFromUrl(folder.url);

      if (path !== location.pathname) {
        locationService.push(path);
      }

      return { folder, pageNavModel: { ...navModel, main: folderNav } };
    });
  }, [match.params.uid]);

  return (
    <Page navModel={value?.pageNavModel ?? navModel}>
      <Page.Contents isLoading={loading}>
        <ManageDashboards folder={value?.folder} />
      </Page.Contents>
    </Page>
  );
});

DashboardListPage.displayName = 'DashboardListPage';

const mapStateToProps: MapStateToProps<DashboardListPageConnectedProps, {}, StoreState> = (state) => {
  return {
    navModel: getNavModel(state.navIndex, 'manage-dashboards'),
  };
};

export default connect(mapStateToProps)(DashboardListPage);
