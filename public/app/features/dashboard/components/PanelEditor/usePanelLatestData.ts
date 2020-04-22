import { PanelData } from '@grafana/data';
import { useEffect, useRef, useState } from 'react';
import { PanelModel } from '../../state';
import { Unsubscribable } from 'rxjs';

export const usePanelLatestData = (panel: PanelModel): [PanelData | null, boolean] => {
  const querySubscription = useRef<Unsubscribable>(null);
  const [latestData, setLatestData] = useState<PanelData>(null);

  useEffect(() => {
    querySubscription.current = panel
      .getQueryRunner()
      .getData()
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
