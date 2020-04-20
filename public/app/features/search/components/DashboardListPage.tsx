import React, { FC, memo } from 'react';
import { useAsync } from 'react-use';
import { connect, MapStateToProps } from 'react-redux';
import { NavModel, locationUtil } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParams } from 'app/core/selectors/location';
import Page from 'app/core/components/Page/Page';
import { backendSrv } from 'app/core/services/backend_srv';
import { ManageDashboards } from './ManageDashboards';

interface Props {
  navModel: NavModel;
  uid?: string;
}

export const DashboardListPage: FC<Props> = memo(({ navModel, uid }) => {
  const { loading, value } = useAsync(() => {
    if (uid) {
      return backendSrv.getFolderByUid(uid).then((folder: any) => {
        const url = locationUtil.stripBaseFromUrl(folder.url);

        if (url !== location.pathname) {
          getLocationSrv().update({ path: url });
        }

        return folder.id;
      });
    } else {
      return Promise.resolve(undefined);
    }
  }, [uid]);

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={loading}>
        <ManageDashboards folderUid={uid} folderId={value} />
      </Page.Contents>
    </Page>
  );
});

const mapStateToProps: MapStateToProps<Props, {}, StoreState> = state => ({
  navModel: getNavModel(state.navIndex, 'manage-dashboards'),
  uid: getRouteParams(state.location).uid as string | undefined,
});

export default connect(mapStateToProps)(DashboardListPage);
