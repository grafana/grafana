import React, { FC, memo } from 'react';
import { useAsync } from 'react-use';
import { connect, MapStateToProps } from 'react-redux';
import { NavModel, locationUtil } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParams } from 'app/core/selectors/location';
import Page from 'app/core/components/Page/Page';
import { loadFolderPage } from '../loaders';
import { ManageDashboards } from './ManageDashboards';

interface Props {
  navModel: NavModel;
  uid?: string;
}

export const DashboardListPage: FC<Props> = memo(({ navModel, uid }) => {
  const { loading, value } = useAsync(() => {
    if (!uid) {
      return Promise.resolve({ pageNavModel: navModel });
    }
    return loadFolderPage(uid, 'manage-folder-dashboards').then(({ folder, model }) => {
      const url = locationUtil.stripBaseFromUrl(folder.url);

      if (url !== location.pathname) {
        getLocationSrv().update({ path: url });
      }

      return { id: folder.id, pageNavModel: { ...navModel, ...model } };
    });
  }, [uid]);

  return (
    <Page navModel={value?.pageNavModel}>
      <Page.Contents isLoading={loading}>
        <ManageDashboards folderUid={uid} folderId={value?.id} />
      </Page.Contents>
    </Page>
  );
});

const mapStateToProps: MapStateToProps<Props, {}, StoreState> = state => ({
  navModel: getNavModel(state.navIndex, 'manage-dashboards'),
  uid: getRouteParams(state.location).uid as string | undefined,
});

export default connect(mapStateToProps)(DashboardListPage);
