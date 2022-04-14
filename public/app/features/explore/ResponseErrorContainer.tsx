import React from 'react';
import { useSelector } from 'react-redux';
import { ExploreId, StoreState } from '../../types';
import { LoadingState } from '@grafana/data';
import { ErrorContainer } from './ErrorContainer';

interface Props {
  exploreId: ExploreId;
}
export function ResponseErrorContainer(props: Props) {
  const queryResponse = useSelector((state: StoreState) => state.explore[props.exploreId]?.queryResponse);

  const queryError = queryResponse?.state === LoadingState.Error ? queryResponse?.error : undefined;

  return <ErrorContainer queryError={queryError} />;
}
