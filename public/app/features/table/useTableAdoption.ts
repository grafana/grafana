import { useEffect, useRef } from 'react';

import { reportInteraction } from '@grafana/runtime';

interface TableAvailability {
  column_management_available: boolean;
  filtering_available: boolean;
  range_filters_available: boolean;
  pagination_available: boolean;
  zebra_striping_available: boolean;
  zebra_striping_enabled: boolean;
}

export function useTableAdoption(hasData: boolean, availability: TableAvailability) {
  const previous = useRef<string | undefined>(undefined);
  const state = JSON.stringify(availability);
  useEffect(() => {
    if (hasData && state !== previous.current) {
      reportInteraction('grafana_table_viewed_features', {
        ...JSON.parse(state),
      });
      previous.current = state;
    }
  }, [hasData, state]);
}
