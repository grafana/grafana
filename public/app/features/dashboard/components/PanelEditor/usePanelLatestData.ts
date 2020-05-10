import { DataQueryError, LoadingState, PanelData, PanelPlugin } from '@grafana/data';
import { useEffect, useRef, useState } from 'react';
import { PanelModel } from '../../state';
import { Unsubscribable } from 'rxjs';
import { GetDataOptions } from '../../state/PanelQueryRunner';

/**
 * Subscribes and returns latest panel data from PanelQueryRunner
 */
export const usePanelLatestData = (
  panel: PanelModel,
  plugin: PanelPlugin,
  options?: GetDataOptions
): [PanelData | undefined, boolean, DataQueryError | undefined] => {
  const querySubscription = useRef<Unsubscribable>(null);
  const [latestData, setLatestData] = useState<PanelData>();

  useEffect(() => {
    /**
     * This init process where we do not have a plugin to start with is to handle full page reloads with inspect url parameter
     */
    if (plugin && !plugin.meta.skipDataQuery) {
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
    }
    return () => {};
  }, [panel, plugin, options]);

  return [
    latestData,
    // Loading state
    latestData ? latestData.state === LoadingState.Loading : true,
    // Error
    latestData && latestData.error,
  ];
};
