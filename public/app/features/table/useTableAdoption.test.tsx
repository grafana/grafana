import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';

import { reportInteraction } from '@grafana/runtime';

import { useTableAdoption } from './useTableAdoption';

jest.mock('@grafana/runtime', () => ({ reportInteraction: jest.fn() }));

it('reports usable view and changed state, without duplicate refresh or StrictMode events', () => {
  const availability = {
    column_management_available: true,
    filtering_available: true,
    range_filters_available: true,
    pagination_available: false,
    zebra_striping_available: true,
    zebra_striping_enabled: false,
  };
  const { rerender } = renderHook(
    ({ hasData, enabled }) => useTableAdoption(hasData, { ...availability, zebra_striping_enabled: enabled }),
    {
      initialProps: { hasData: false, enabled: false },
      wrapper: StrictMode,
    }
  );
  expect(reportInteraction).not.toHaveBeenCalled();
  rerender({ hasData: true, enabled: false });
  expect(reportInteraction).toHaveBeenLastCalledWith('grafana_table_viewed_features', {
    ...availability,
  });
  rerender({ hasData: false, enabled: false });
  rerender({ hasData: true, enabled: false });
  expect(reportInteraction).toHaveBeenCalledTimes(1);
  rerender({ hasData: true, enabled: true });
  expect(reportInteraction).toHaveBeenLastCalledWith('grafana_table_viewed_features', {
    ...availability,
    zebra_striping_enabled: true,
  });
  expect(reportInteraction).toHaveBeenCalledTimes(2);
});
