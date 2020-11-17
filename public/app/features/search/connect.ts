import React from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { StoreState } from 'app/types';
import { getLocationQuery } from 'app/core/selectors/location';
import { updateLocation } from 'app/core/reducers/location';
import { parseRouteParams } from './utils';
import { DashboardQuery } from './types';
import { Props as DashboardSearchProps } from './components/DashboardSearch';
import { Props as ManageDashboardsProps } from './components/ManageDashboards';

export interface ConnectProps {
  params: Partial<DashboardQuery>;
}

export interface DispatchProps {
  updateLocation: typeof updateLocation;
}

type Props = DashboardSearchProps | ManageDashboardsProps;

const mapStateToProps: MapStateToProps<ConnectProps, Props, StoreState> = state => {
  const { query, starred, sort, tag, layout, folder } = getLocationQuery(state.location);
  return parseRouteParams(
    {
      query,
      tag,
      starred,
      sort,
      layout,
    },
    folder
  );
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, Props> = {
  updateLocation,
};

export const connectWithRouteParams = (Component: React.FC) =>
  connectWithStore(Component, mapStateToProps, mapDispatchToProps);
