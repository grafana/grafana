import Page from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';
import React from 'react';
import { useSelector } from 'react-redux';
import { useAsync } from 'react-use';
import { useGetFolderByUid } from './state/actions';
import { getLoadingNav } from './state/navModel';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

const FolderAlerting = ({ match }: OwnProps) => {
  const getFolderByUid = useGetFolderByUid();
  const navIndex = useSelector((state: StoreState) => state.navIndex);

  const uid = match.params.uid;
  const navModel = getNavModel(navIndex, `folder-alerting-${uid}`, getLoadingNav(1));

  const { loading } = useAsync(async () => await getFolderByUid(uid), [getFolderByUid, uid]);

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={loading}>
        <div>Alerting!!!</div>
      </Page.Contents>
    </Page>
  );
};

export default FolderAlerting;
