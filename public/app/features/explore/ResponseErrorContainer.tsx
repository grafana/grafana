import { DataQueryError, LoadingState, PanelData } from '@grafana/data';
import { useSelector } from 'app/types/store';

import { ErrorContainer } from './ErrorContainer';

interface Props {
  exploreId: string;
}

function getQueryError(queryResponse: PanelData | undefined): DataQueryError | undefined {
  if (queryResponse?.state === LoadingState.Error) {
    return queryResponse.error;
  }
  if (queryResponse?.state === LoadingState.Done) {
    return queryResponse.errors?.find((e) => !e.refId);
  }
  return undefined;
}

export function ResponseErrorContainer(props: Props) {
  const queryResponse = useSelector((state) => state.explore.panes[props.exploreId]!.queryResponse);
  const queryError = getQueryError(queryResponse);

  // No error, or error with a refId (shown below the corresponding query)
  if (!queryError || queryError.refId) {
    return null;
  }

  return <ErrorContainer queryError={queryError} />;
}
