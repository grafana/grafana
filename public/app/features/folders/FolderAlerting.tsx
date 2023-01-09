import React from 'react';
import { useAsync } from 'react-use';

import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navBarTree';
import { useDispatch, useSelector } from 'app/types';

import { AlertsFolderView } from '../alerting/unified/AlertsFolderView';

import { getFolderByUid } from './state/actions';
import { getLoadingNav } from './state/navModel';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

const FolderAlerting = ({ match }: OwnProps) => {
  const dispatch = useDispatch();
  // TODO: maybe this can use useNavItem(...) ?? getLoadingNav(1) ?
  const pageNav = useSelector((state) => getNavModel(state.navBarTree, `folder-alerting-${uid}`, getLoadingNav(1)));
  const folder = useSelector((state) => state.folder);

  const uid = match.params.uid;

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
