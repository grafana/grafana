import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LoadingState, type PanelData } from '@grafana/data';

import { type AlertQuery } from '../../../../../../types/unified-alerting-dto';
import { AlertingQueryRunner } from '../../../state/AlertingQueryRunner';

export function useAlertQueryRunner() {
  const [queryPreviewData, setQueryPreviewData] = useState<Record<string, PanelData>>({});

  const runner = useRef<AlertingQueryRunner | null>(null);

  useEffect(() => {
    // StrictMode destroys the first runner on its simulated unmount, so each mount needs its own
    const currentRunner = new AlertingQueryRunner();
    runner.current = currentRunner;

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
    runner.current?.cancel();
  }, []);

  const runQueries = useCallback(
    (queriesToPreview: AlertQuery[], condition: string) => runner.current?.run(queriesToPreview, condition),
    []
  );

  const isPreviewLoading = useMemo(() => {
    return Object.values(queryPreviewData).some((d) => d.state === LoadingState.Loading);
  }, [queryPreviewData]);

  return { queryPreviewData, runQueries, cancelQueries, isPreviewLoading, clearPreviewData };
}
