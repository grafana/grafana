import React, { FC, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { StoreState } from '../../types';
import { getNavModel } from '../../core/selectors/navModel';
import Page from '../../core/components/Page/Page';
import { LibraryPanelsView } from './components/LibraryPanelsView/LibraryPanelsView';
import { useAsync } from 'react-use';
import { getLibraryPanels } from './state/api';
import PageActionBar from '../../core/components/PageActionBar/PageActionBar';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'library-panels'),
});

const connector = connect(mapStateToProps, undefined);

interface OwnProps extends GrafanaRouteComponentProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

export const LibraryPanelsPage: FC<Props> = ({ navModel }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { value: searchResult, loading } = useAsync(async () => {
    return getLibraryPanels();
  });
  const hasLibraryPanels = Boolean(searchResult?.libraryPanels.length);

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={loading}>
        {hasLibraryPanels && (
          <PageActionBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder={'Search by name'} />
        )}
        <LibraryPanelsView
          onClickCard={() => undefined}
          searchString={searchQuery}
          currentPanelId={undefined}
          showSecondaryActions={true}
          perPage={DEFAULT_PER_PAGE_PAGINATION}
        />
      </Page.Contents>
    </Page>
  );
};

export default connect(mapStateToProps)(LibraryPanelsPage);
