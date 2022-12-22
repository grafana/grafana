import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useAsync } from 'react-use';

import { Page } from 'app/core/components/Page/Page';

import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { getNavModel } from '../../core/selectors/navModel';
import { StoreState } from '../../types';
import { LibraryPanelsSearch } from '../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from '../library-panels/components/OpenLibraryPanelModal/OpenLibraryPanelModal';
import { LibraryElementDTO } from '../library-panels/types';

import { getFolderByUid } from './state/actions';
import { getLoadingNav } from './state/navModel';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

const mapStateToProps = (state: StoreState, props: OwnProps) => {
  const uid = props.match.params.uid;
  return {
    pageNav: getNavModel(state.navIndex, `folder-library-panels-${uid}`, getLoadingNav(1)),
    folderUid: uid,
  };
};

const mapDispatchToProps = {
  getFolderByUid,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export function FolderLibraryPanelsPage({ pageNav, getFolderByUid, folderUid }: Props): JSX.Element {
  const { loading } = useAsync(async () => await getFolderByUid(folderUid), [getFolderByUid, folderUid]);
  const [selected, setSelected] = useState<LibraryElementDTO | undefined>(undefined);

  return (
    <Page navId="dashboards/browse" pageNav={pageNav.main}>
      <Page.Contents isLoading={loading}>
        <LibraryPanelsSearch
          onClick={setSelected}
          currentFolderUID={folderUid}
          showSecondaryActions
          showSort
          showPanelFilter
        />
        {selected ? <OpenLibraryPanelModal onDismiss={() => setSelected(undefined)} libraryPanel={selected} /> : null}
      </Page.Contents>
    </Page>
  );
}

export default connector(FolderLibraryPanelsPage);
