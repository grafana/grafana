import React from 'react';

import { LoadingState } from '@grafana/data';
import { useSelector } from 'app/types';

import { ErrorContainer } from './ErrorContainer';

interface Props {
  exploreId: string;
}
export function ResponseErrorContainer(props: Props) {
  const queryResponse = useSelector((state) => state.explore.panes[props.exploreId]!.queryResponse);
  const queryError = queryResponse?.state === LoadingState.Error ? queryResponse?.error : undefined;

  // Errors with ref ids are shown below the corresponding query
  if (queryError?.refId) {
    return null;
  }

  return <ErrorContainer queryError={queryError} />;
}
