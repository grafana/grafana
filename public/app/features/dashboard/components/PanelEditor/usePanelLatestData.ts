import { DataQueryError, LoadingState, PanelData } from '@grafana/data';
import { useEffect, useRef, useState } from 'react';
import { PanelModel } from '../../state';
import { Unsubscribable } from 'rxjs';
import { GetDataOptions } from '../../state/PanelQueryRunner';

interface UsePanelLatestData {
  data?: PanelData;
  error?: DataQueryError;
  isLoading: boolean;
  hasSeries: boolean;
}

/**
 * Subscribes and returns latest panel data from PanelQueryRunner
 */
export const usePanelLatestData = (panel: PanelModel, options: GetDataOptions): UsePanelLatestData => {
  const querySubscription = useRef<Unsubscribable>(null);
  const [latestData, setLatestData] = useState<PanelData>();

  useEffect(() => {
    querySubscription.current = panel
      .getQueryRunner()
      .getData(options)
      .subscribe({
        next: data => setLatestData(data),
      });

    return () => {
      if (querySubscription.current) {
        querySubscription.current.unsubscribe();
      }
    };
    /**
     * Adding separate options to dependencies array to avoid additional hook for comparing previous options with current.
     * Otherwise, passing different references to the same object may cause troubles.
     */
  }, [panel, options.withFieldConfig, options.withTransforms]);

  return {
    data: latestData,
    error: latestData && latestData.error,
    isLoading: latestData ? latestData.state === LoadingState.Loading : true,
    hasSeries: latestData ? !!latestData.series : false,
  };
};
