import React, { FC, memo } from 'react';
import { connect, ConnectedProps, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { UrlQueryMap } from '@grafana/data';
import { getLocationQuery } from 'app/core/selectors/location';
import { updateLocation } from 'app/core/reducers/location';
import { StoreState } from 'app/types';
import DashboardSearch from './DashboardSearch';
import { defaultQueryParams } from '../reducers/searchQueryReducer';

interface OwnProps {
  search?: string | null;
  folder?: string;
  queryText?: string;
  filter?: string;
}

interface DispatchProps {
  updateLocation: typeof updateLocation;
}

const mapStateToProps: MapStateToProps<{}, OwnProps, StoreState> = (state: StoreState) => {
  const { search, folder } = getLocationQuery(state.location);
  return { search, folder };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  updateLocation,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export const SearchWrapperUnConnected: FC<Props> = memo(({ search, folder, updateLocation }) => {
  const isOpen = search === 'open';

  const closeSearch = () => {
    if (isOpen) {
      updateLocation({
        query: {
          search: null,
          folder: null,
          ...defaultQueryParams,
        } as UrlQueryMap,
        partial: true,
      });
    }
  };

  return isOpen ? <DashboardSearch onCloseSearch={closeSearch} folder={folder} /> : null;
});

SearchWrapperUnConnected.displayName = 'SearchWrapper';

export const SearchWrapper = connector(SearchWrapperUnConnected);
