import { useEffect, useRef, useState } from 'react';
import { Unsubscribable } from 'rxjs';

import { LoadingState, PanelData } from '@grafana/data';

import { GetDataOptions } from '../../../query/state/PanelQueryRunner';
import { PanelModel } from '../../state/PanelModel';

interface UsePanelLatestData {
  data?: PanelData;
  hasError: boolean;
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
      // We apply field config later
      .getData({ withTransforms: options.withTransforms, withFieldConfig: false })
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
  }, [panel, options.withTransforms]);

  return {
    data: latestData,
    isLoading: latestData?.state === LoadingState.Loading,
    hasSeries: latestData ? !!latestData.series : false,
    hasError: Boolean(
      latestData && (latestData.error || latestData?.errors?.length || latestData.state === LoadingState.Error)
    ),
  };
};
