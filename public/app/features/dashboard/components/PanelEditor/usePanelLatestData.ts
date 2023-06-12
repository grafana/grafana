import { useEffect, useRef, useState } from 'react';
import { Unsubscribable } from 'rxjs';

import { DataQueryError, LoadingState, PanelData } from '@grafana/data';

import { GetDataOptions } from '../../../query/state/PanelQueryRunner';
import { PanelModel } from '../../state';

interface UsePanelLatestData {
  data?: PanelData;
  error?: DataQueryError;
  isLoading: boolean;
  hasSeries: boolean;
}

/**
 * Subscribes and returns latest panel data from PanelQueryRunner
 */
export const usePanelLatestData = (
  panel: PanelModel,
  options: GetDataOptions,
  checkSchema?: boolean
): UsePanelLatestData => {
  const querySubscription = useRef<Unsubscribable>();
  const [latestData, setLatestData] = useState<PanelData>();

  useEffect(() => {
    let lastRev = -1;
    let lastUpdate = 0;

    querySubscription.current = panel
      .getQueryRunner()
      .getData(options)
      .subscribe({
        next: (data) => {
          if (checkSchema) {
            if (lastRev === data.structureRev) {
              const now = Date.now();
              const elapsed = now - lastUpdate;
              if (elapsed < 10000) {
                return; // avoid updates if the schema has not changed for 10s
              }
              lastUpdate = now;
            }
            lastRev = data.structureRev ?? -1;
          }
          setLatestData(data);
        },
      });

    return () => {
      if (querySubscription.current) {
        querySubscription.current.unsubscribe();
      }
    };
    /**
     * Adding separate options to dependencies array to avoid additional hook for comparing previous options with current.
     * Otherwise, passing different references to the same object might cause troubles.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, options.withFieldConfig, options.withTransforms]);

  return {
    data: latestData,
    error: latestData && latestData.error,
    isLoading: latestData ? latestData.state === LoadingState.Loading : true,
    hasSeries: latestData ? !!latestData.series : false,
  };
};
