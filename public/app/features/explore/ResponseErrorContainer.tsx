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

  // Only show error if it does not have refId. Otherwise let query row to handle it so this condition has to be matched
  // with QueryRow.tsx so we don't loose errors.
  const queryError =
    queryResponse?.state === LoadingState.Error && queryResponse?.error && !queryResponse.error.refId
      ? queryResponse.error
      : undefined;

  return <ErrorContainer queryError={queryError} />;
}
