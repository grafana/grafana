import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAsync } from 'react-use';

import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

import { AlertsFolderView } from '../alerting/unified/AlertsFolderView';

import { getFolderByUid } from './state/actions';
import { getLoadingNav } from './state/navModel';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

const FolderAlerting = ({ match }: OwnProps) => {
  const dispatch = useDispatch();
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const folder = useSelector((state: StoreState) => state.folder);

  const uid = match.params.uid;
  const pageNav = getNavModel(navIndex, `folder-alerting-${uid}`, getLoadingNav(1));

  const { loading } = useAsync(async () => dispatch(getFolderByUid(uid)), [getFolderByUid, uid]);

  return (
    <Page navId="dashboards/browse" pageNav={pageNav.main}>
      <Page.Contents isLoading={loading}>
        <AlertsFolderView folder={folder} />
      </Page.Contents>
    </Page>
  );
};

export default FolderAlerting;
