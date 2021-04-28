import React, { FC } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { StoreState } from '../../types';
import { getNavModel } from '../../core/selectors/navModel';
import Page from '../../core/components/Page/Page';
import { LibraryPanelsSearch } from './components/LibraryPanelsSearch/LibraryPanelsSearch';

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'library-panels'),
});

const connector = connect(mapStateToProps, undefined);

interface OwnProps extends GrafanaRouteComponentProps {}

type Props = OwnProps & ConnectedProps<typeof connector>;

export const LibraryPanelsPage: FC<Props> = ({ navModel }) => {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <LibraryPanelsSearch onClick={noop} showSecondaryActions showSort showFilter />
      </Page.Contents>
    </Page>
  );
};

function noop() {}

export default connect(mapStateToProps)(LibraryPanelsPage);
