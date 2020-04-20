import React, { FC, memo } from 'react';
import { useAsync } from 'react-use';
import { connect, MapStateToProps } from 'react-redux';
import { NavModel, locationUtil } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParams, getUrl } from 'app/core/selectors/location';
import Page from 'app/core/components/Page/Page';
import { backendSrv } from 'app/core/services/backend_srv';
import { ManageDashboards } from './ManageDashboards';

interface Props {
  navModel: NavModel;
  uid?: string;
  url: string;
}

export const DashboardListPage: FC<Props> = memo(({ navModel, uid, url }) => {
  const { loading, value } = useAsync(() => {
    // Do not make api call on route change
    if (uid && url.startsWith('/dashboards')) {
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

const mapStateToProps: MapStateToProps<Props, {}, StoreState> = state => {
  return {
    navModel: getNavModel(state.navIndex, 'manage-dashboards'),
    uid: getRouteParams(state.location).uid as string | undefined,
    url: getUrl(state.location),
  };
};

export default connect(mapStateToProps)(DashboardListPage);
