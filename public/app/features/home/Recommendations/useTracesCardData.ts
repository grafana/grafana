import { useAsync } from 'react-use';

import { fetchSpanRateSeries, fetchTopErrorService, fetchTracesServices, resolveTracesDatasource } from './tracesData';

export function useTracesCardData() {
  const { value: resolution, loading: resolving, error: resolutionError } = useAsync(resolveTracesDatasource, []);
  const { value: serviceCount, loading: servicesLoading } = useAsync(fetchTracesServices, []);
  const { value: spanRate, loading: spanRateLoading } = useAsync(fetchSpanRateSeries, []);
  const { value: topErrorService } = useAsync(fetchTopErrorService, []);
  return {
    resolution,
    resolving,
    resolutionError,
    serviceCount,
    servicesLoading,
    spanRate,
    spanRateLoading,
    topErrorService,
  };
}
