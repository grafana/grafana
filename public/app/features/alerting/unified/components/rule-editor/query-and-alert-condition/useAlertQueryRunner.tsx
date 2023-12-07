import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LoadingState, PanelData } from '@grafana/data';

import { AlertQuery } from '../../../../../../types/unified-alerting-dto';
import { AlertingQueryRunner } from '../../../state/AlertingQueryRunner';

export function useAlertQueryRunner() {
  const [queryPreviewData, setQueryPreviewData] = useState<Record<string, PanelData>>({});

  const runner = useRef(new AlertingQueryRunner());

  useEffect(() => {
    const currentRunner = runner.current;

    currentRunner.get().subscribe((data) => {
      setQueryPreviewData(data);
    });

    return () => {
      currentRunner.destroy();
    };
  }, []);

  const clearPreviewData = useCallback(() => {
    setQueryPreviewData({});
  }, []);

  const cancelQueries = useCallback(() => {
    runner.current.cancel();
  }, []);

  const runQueries = useCallback((queriesToPreview: AlertQuery[]) => {
    runner.current.run(queriesToPreview);
  }, []);

  const isPreviewLoading = useMemo(() => {
    return Object.values(queryPreviewData).some((d) => d.state === LoadingState.Loading);
  }, [queryPreviewData]);

  return { queryPreviewData, runQueries, cancelQueries, isPreviewLoading, clearPreviewData };
}
