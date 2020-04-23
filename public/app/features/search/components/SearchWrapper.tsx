import React, { FC, memo } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { getLocationQuery } from 'app/core/selectors/location';
import { updateLocation } from 'app/core/reducers/location';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { StoreState } from 'app/types';
import { DashboardSearch } from './DashboardSearch';

interface OwnProps {
  search?: string | null;
  folder?: string;
  queryText?: string;
  filter?: string;
}

interface DispatchProps {
  updateLocation: typeof updateLocation;
}

export type Props = OwnProps & DispatchProps;

export const SearchWrapper: FC<Props> = memo(({ search, folder, updateLocation }) => {
  const isOpen = search === 'open';

  const closeSearch = () => {
    if (search === 'open') {
      updateLocation({
        query: {
          search: null,
          folder: null,
        },
        partial: true,
      });
    }
  };

  return isOpen ? <DashboardSearch onCloseSearch={closeSearch} folder={folder} /> : null;
});

const mapStateToProps: MapStateToProps<{}, OwnProps, StoreState> = (state: StoreState) => {
  const { search, folder } = getLocationQuery(state.location);
  return { search, folder };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  updateLocation,
};

export default connectWithStore(SearchWrapper, mapStateToProps, mapDispatchToProps);
