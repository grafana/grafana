import { PanelData } from '@grafana/data';
import { useEffect, useRef, useState } from 'react';
import { PanelModel } from '../../state';
import { Unsubscribable } from 'rxjs';
import { GetDataOptions } from '../../state/PanelQueryRunner';

export const usePanelLatestData = (panel: PanelModel, options: GetDataOptions): [PanelData | null, boolean] => {
  const querySubscription = useRef<Unsubscribable>(null);
  const [latestData, setLatestData] = useState<PanelData>(null);

  useEffect(() => {
    querySubscription.current = panel
      .getQueryRunner()
      .getData(options)
      .subscribe({
        next: data => setLatestData(data),
      });

    return () => {
      if (querySubscription.current) {
        console.log('unsubscribing');
        querySubscription.current.unsubscribe();
      }
    };
  }, [panel]);

  return [
    latestData,
    // TODO: make this more clever, use PanelData.state
    !!(latestData && latestData.series),
  ];
};
