import { render, screen } from '@testing-library/react';

import createMockQuery from '../../mocks/query';
import {
  type AzureLogAnalyticsMetadataColumn,
  type AzureLogAnalyticsMetadataTable,
} from '../../types/logAnalyticsMetadata';
import { TablePlan } from '../../types/types';
import { selectOptionInTest } from '../../utils/testUtils';

import { TableSection } from './TableSection';

const baseTable = (overrides: Partial<AzureLogAnalyticsMetadataTable>): AzureLogAnalyticsMetadataTable => ({
  id: overrides.name ?? 'table',
  name: overrides.name ?? 'table',
  timespanColumn: 'TimeGenerated',
  columns: [],
  related: { solutions: [] },
  ...overrides,
});

const mockTables: AzureLogAnalyticsMetadataTable[] = [
  baseTable({ name: 'AnalyticsTable', plan: TablePlan.Analytics }),
  baseTable({ name: 'BasicTable', plan: TablePlan.Basic }),
  baseTable({ name: 'AuxiliaryTable', plan: TablePlan.Auxiliary }),
];

const mockColumns: AzureLogAnalyticsMetadataColumn[] = [
  { name: 'TimeGenerated', type: 'datetime' },
  { name: 'Level', type: 'string' },
];

const renderTableSection = (overrides: Partial<React.ComponentProps<typeof TableSection>> = {}) => {
  const buildAndUpdateQuery = jest.fn();
  const onQueryChange = jest.fn();
  const query = overrides.query ?? createMockQuery();
  render(
    <TableSection
      allColumns={mockColumns}
      tables={mockTables}
      query={query}
      buildAndUpdateQuery={buildAndUpdateQuery}
      onQueryChange={onQueryChange}
      isLoadingSchema={false}
      {...overrides}
    />
  );
  return { buildAndUpdateQuery, onQueryChange };
};

describe('TableSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('per-tier table availability', () => {
    it('disables Basic-plan tables when basicLogsEnabled is false', async () => {
      renderTableSection({ basicLogsEnabled: false, auxiliaryLogsEnabled: true });

      const select = await screen.findByLabelText('Table');
      await selectOptionInTest(select, 'BasicTable').catch(() => {
        // selectOptionInTest throws when the option is disabled / non-selectable; that's exactly what we want to assert.
      });

      // Option remains visible but is non-selectable, so the table selection isn't applied.
      // We verify via the description text rendered in the menu.
      expect(
        screen.getByText(
          'This table is on the Basic Logs plan. Enable "Basic Logs" in the data source settings to query it.'
        )
      ).toBeInTheDocument();
    });

    it('disables Auxiliary-plan tables when auxiliaryLogsEnabled is false', async () => {
      renderTableSection({ basicLogsEnabled: true, auxiliaryLogsEnabled: false });

      const select = await screen.findByLabelText('Table');
      await selectOptionInTest(select, 'AuxiliaryTable').catch(() => {
        // expected when the option is disabled
      });

      expect(
        screen.getByText(
          'This table is on the Auxiliary Logs plan. Enable "Auxiliary Logs" in the data source settings to query it.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('handleTableChange writes the correct logTier', () => {
    it('sets logTier=Basic and basicLogsQuery=true when picking a Basic-plan table', async () => {
      const { buildAndUpdateQuery } = renderTableSection({
        basicLogsEnabled: true,
        auxiliaryLogsEnabled: true,
      });

      const select = await screen.findByLabelText('Table');
      await selectOptionInTest(select, 'BasicTable');

      expect(buildAndUpdateQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          basicLogsQuery: true,
          logTier: 'Basic',
        })
      );
    });

    it('sets logTier=Auxiliary and basicLogsQuery=true when picking an Auxiliary-plan table', async () => {
      const { buildAndUpdateQuery } = renderTableSection({
        basicLogsEnabled: true,
        auxiliaryLogsEnabled: true,
      });

      const select = await screen.findByLabelText('Table');
      await selectOptionInTest(select, 'AuxiliaryTable');

      expect(buildAndUpdateQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          basicLogsQuery: true,
          logTier: 'Auxiliary',
        })
      );
    });

    it('clears logTier and basicLogsQuery when picking an Analytics-plan table', async () => {
      const { buildAndUpdateQuery } = renderTableSection({
        basicLogsEnabled: true,
        auxiliaryLogsEnabled: true,
      });

      const select = await screen.findByLabelText('Table');
      await selectOptionInTest(select, 'AnalyticsTable');

      expect(buildAndUpdateQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          basicLogsQuery: false,
          logTier: undefined,
        })
      );
    });

    it('does not call buildAndUpdateQuery when a disabled Basic table is somehow selected', async () => {
      const { buildAndUpdateQuery } = renderTableSection({
        basicLogsEnabled: false,
        auxiliaryLogsEnabled: true,
      });

      const select = await screen.findByLabelText('Table');
      await selectOptionInTest(select, 'BasicTable').catch(() => {
        // expected when the option is disabled
      });

      expect(buildAndUpdateQuery).not.toHaveBeenCalled();
    });
  });
});
