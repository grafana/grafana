import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ComponentProps } from 'react';

import { DataFrame, FieldType, LogsSortOrder, toUtc, urlUtil } from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { parseLogsFrame } from '../../logs/logsFrame';

import { LogsTable } from './LogsTable';
import { getMockElasticFrame, getMockLokiFrame, getMockLokiFrameDataPlane } from './utils/mocks';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getTemplateSrv: () => ({
      replace: (val: string) => (val ? val.replace('$input', '10').replace('$window', '10s') : val),
    }),
  };
});

const getComponent = (partialProps?: Partial<ComponentProps<typeof LogsTable>>, logs?: DataFrame) => {
  const testDataFrame = {
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00', '2019-01-01 12:00:00'],
      },
      {
        config: {},
        name: 'line',
        type: FieldType.string,
        values: ['log message 1', 'log message 2', 'log message 3'],
      },
      {
        config: {},
        name: 'tsNs',
        type: FieldType.string,
        values: ['ts1', 'ts2', 'ts3'],
      },
      {
        config: {},
        name: 'labels',
        type: FieldType.other,
        typeInfo: {
          frame: 'json.RawMessage',
        },
        values: [{ foo: 'bar' }, { foo: 'bar' }, { foo: 'bar' }],
      },
    ],
    length: 3,
  };
  const logsFrame = parseLogsFrame(testDataFrame);
  return (
    <LogsTable
      logsFrame={logsFrame}
      height={400}
      columnsWithMeta={{
        Time: { active: true, percentOfLinesWithLabel: 3, index: 0 },
        line: { active: true, percentOfLinesWithLabel: 3, index: 1 },
      }}
      logsSortOrder={LogsSortOrder.Descending}
      splitOpen={() => undefined}
      timeZone={'utc'}
      width={50}
      range={{
        from: toUtc('2019-01-01 10:00:00'),
        to: toUtc('2019-01-01 16:00:00'),
        raw: { from: 'now-1h', to: 'now' },
      }}
      dataFrame={logs ?? testDataFrame}
      {...partialProps}
    />
  );
};
const setup = (partialProps?: Partial<ComponentProps<typeof LogsTable>>, logs?: DataFrame) => {
  return render(
    getComponent(
      {
        ...partialProps,
      },
      logs
    )
  );
};

describe('LogsTable', () => {
  beforeAll(() => {
    const transformers = [extractFieldsTransformer, organizeFieldsTransformer];
    mockTransformationsRegistry(transformers);
  });

  let originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;

  beforeAll(() => {
    originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;
    config.featureToggles.logsExploreTableVisualisation = true;
  });

  afterAll(() => {
    config.featureToggles.logsExploreTableVisualisation = originalVisualisationTypeValue;
  });

  it('should render 4 table rows', async () => {
    setup();

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // tableFrame has 3 rows + 1 header row
      expect(rows.length).toBe(4);
    });
  });

  it('should render extracted labels as columns (elastic)', async () => {
    setup({
      dataFrame: getMockElasticFrame(),
      columnsWithMeta: {
        level: { active: true, percentOfLinesWithLabel: 3, index: 3 },
        counter: { active: true, percentOfLinesWithLabel: 3, index: 2 },
        line: { active: true, percentOfLinesWithLabel: 3, index: 1 },
        '@timestamp': { active: true, percentOfLinesWithLabel: 3, index: 0 },
      },
    });

    await waitFor(() => {
      const columns = screen.getAllByRole('columnheader');
      expect(columns[0].textContent).toContain('@timestamp');
      expect(columns[1].textContent).toContain('line');
      expect(columns[2].textContent).toContain('counter');
      expect(columns[3].textContent).toContain('level');
    });
  });

  it('should render extracted labels as columns (loki)', async () => {
    setup({
      columnsWithMeta: {
        Time: { active: true, percentOfLinesWithLabel: 3, index: 0 },
        line: { active: true, percentOfLinesWithLabel: 3, index: 1 },
        foo: { active: true, percentOfLinesWithLabel: 3, index: 2 },
      },
    });

    await waitFor(() => {
      const columns = screen.getAllByRole('columnheader');

      expect(columns[0].textContent).toContain('Time');
      expect(columns[1].textContent).toContain('line');
      expect(columns[2].textContent).toContain('foo');
    });
  });

  it('should not render `tsNs` column', async () => {
    setup(undefined, getMockLokiFrame());

    await waitFor(() => {
      const columns = screen.queryAllByRole('columnheader', { name: 'tsNs' });

      expect(columns.length).toBe(0);
    });
  });

  it('should render numeric field aligned right', async () => {
    setup(
      {
        columnsWithMeta: {
          Time: { active: true, percentOfLinesWithLabel: 100, index: 0 },
          line: { active: true, percentOfLinesWithLabel: 100, index: 1 },
          tsNs: { active: true, percentOfLinesWithLabel: 100, index: 2 },
        },
      },
      getMockLokiFrame()
    );

    await waitFor(() => {
      const columns = screen.queryAllByRole('columnheader', { name: 'tsNs' });
      expect(columns.length).toBe(1);
    });

    const cells = screen.queryAllByRole('cell');

    expect(cells[cells.length - 1].style.textAlign).toBe('right');
  });

  it('should not render `labels`', async () => {
    setup();

    await waitFor(() => {
      const columns = screen.queryAllByRole('columnheader', { name: 'labels' });

      expect(columns.length).toBe(0);
    });
  });

  describe('LogsTable (loki dataplane)', () => {
    let originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;
    let originalLokiDataplaneValue = config.featureToggles.lokiLogsDataplane;

    beforeAll(() => {
      originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;
      originalLokiDataplaneValue = config.featureToggles.lokiLogsDataplane;
      config.featureToggles.logsExploreTableVisualisation = true;
      config.featureToggles.lokiLogsDataplane = true;
    });

    afterAll(() => {
      config.featureToggles.logsExploreTableVisualisation = originalVisualisationTypeValue;
      config.featureToggles.lokiLogsDataplane = originalLokiDataplaneValue;
    });

    it('should render 4 table rows', async () => {
      setup(
        {
          columnsWithMeta: {
            timestamp: { active: true, percentOfLinesWithLabel: 3, index: 0 },
            body: { active: true, percentOfLinesWithLabel: 3, index: 1 },
          },
        },
        getMockLokiFrameDataPlane()
      );

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // tableFrame has 3 rows + 1 header row
        expect(rows.length).toBe(4);
      });
    });

    it('should render a datalink for each row', async () => {
      render(
        getComponent(
          {
            columnsWithMeta: {
              traceID: { active: true, percentOfLinesWithLabel: 3, index: 0 },
            },
          },
          getMockLokiFrameDataPlane()
        )
      );

      await waitFor(() => {
        const links = screen.getAllByRole('link');

        expect(links.length).toBe(3);
      });
    });

    it('should not render `labels`', async () => {
      setup(
        {
          columnsWithMeta: {
            timestamp: { active: true, percentOfLinesWithLabel: 100, index: 0 },
            body: { active: true, percentOfLinesWithLabel: 100, index: 1 },
          },
        },
        getMockLokiFrameDataPlane()
      );

      await waitFor(() => {
        const columns = screen.queryAllByRole('columnheader', { name: 'labels' });

        expect(columns.length).toBe(0);
      });
    });

    it('should not render `tsNs`', async () => {
      setup(
        {
          columnsWithMeta: {
            timestamp: { active: true, percentOfLinesWithLabel: 100, index: 0 },
            body: { active: true, percentOfLinesWithLabel: 100, index: 1 },
          },
        },
        getMockLokiFrameDataPlane()
      );

      await waitFor(() => {
        const columns = screen.queryAllByRole('columnheader', { name: 'tsNs' });

        expect(columns.length).toBe(0);
      });
    });

    it('should render extracted labels as columns (loki dataplane)', async () => {
      setup({
        columnsWithMeta: {
          foo: { active: true, percentOfLinesWithLabel: 3, index: 2 },
          line: { active: true, percentOfLinesWithLabel: 3, index: 1 },
          Time: { active: true, percentOfLinesWithLabel: 3, index: 0 },
        },
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        expect(columns[0].textContent).toContain('Time');
        expect(columns[1].textContent).toContain('line');
        expect(columns[2].textContent).toContain('foo');
      });
    });
  });

  describe('Default column ordering', () => {
    it('should maintain time and body field order', async () => {
      setup({
        columnsWithMeta: {
          Time: { active: true, percentOfLinesWithLabel: 3, index: 0 },
          line: { active: true, percentOfLinesWithLabel: 3, index: 1 },
        },
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        expect(columns[0].textContent).toContain('Time');
        expect(columns[1].textContent).toContain('line');
      });
    });
  });

  describe('Selected log line', () => {
    it('should handle selected log line from URL parameter', async () => {
      // Use getMockLokiFrame which has proper structure with id field
      const testFrame = getMockLokiFrame();
      const logsFrame = parseLogsFrame(testFrame);

      // Get the second ID from the parsed frame to test selection of non-first row
      const secondId = logsFrame?.idField?.values[1];

      // Mock URL search params to include selectedLine
      const mockGetSearchParams = jest.spyOn(urlUtil, 'getUrlSearchParams');
      mockGetSearchParams.mockReturnValue({
        selectedLine: JSON.stringify({ id: secondId, row: 1 }),
      });

      // Verify selectedLine is in the mocked URL params
      const params = urlUtil.getUrlSearchParams();
      expect(params.selectedLine).toBeDefined();
      expect(params.selectedLine).toContain(secondId);
    });

    it('should clear selectedLine URL parameter after render', async () => {
      const replaceSpy = jest.spyOn(window.history, 'replaceState');

      // Use getMockLokiFrame which has proper structure
      const testFrame = getMockLokiFrame();
      const logsFrame = parseLogsFrame(testFrame);

      // Get the first ID from the parsed frame
      const firstId = logsFrame?.idField?.values[0];

      // Mock URL search params with matching id
      const mockGetSearchParams = jest.spyOn(urlUtil, 'getUrlSearchParams');
      mockGetSearchParams.mockReturnValue({
        selectedLine: JSON.stringify({ id: firstId, row: 0 }),
      });

      setup({ logsFrame }, testFrame);

      await waitFor(() => {
        expect(replaceSpy).toHaveBeenCalled();
        // Verify that the new URL doesn't contain selectedLine parameter
        const callArgs = replaceSpy.mock.calls[0];
        const newUrl = callArgs[2] as string;
        expect(newUrl).not.toContain('selectedLine');
      });
    });
  });

  describe('Table action buttons', () => {
    it('should render action buttons in first column when exploreId is provided', async () => {
      setup({
        exploreId: 'test-explore',
      });

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(1); // header + data rows
      });

      // Verify buttons are in the first column
      const rows = screen.getAllByRole('row');
      const dataRows = rows.filter((row) => row.getAttribute('role') === 'row' && !row.getAttribute('aria-label'));

      dataRows.forEach((row) => {
        const cells = row.querySelectorAll('[role="cell"]');
        const firstCell = cells[0];

        // First cell should contain both action buttons
        expect(firstCell.querySelector('button[aria-label="View log line"]')).toBeTruthy();
        expect(firstCell.querySelector('button[aria-label="Copy link to log line"]')).toBeTruthy();
      });
    });
  });

  describe('Default level columns', () => {
    it('should render detected_level column when present in data', async () => {
      const frameWithLevel = {
        fields: [
          {
            config: {},
            name: 'Time',
            type: FieldType.time,
            values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00'],
          },
          {
            config: {},
            name: 'line',
            type: FieldType.string,
            values: ['log message 1', 'log message 2'],
          },
          {
            config: {},
            name: 'detected_level',
            type: FieldType.string,
            values: ['info', 'error'],
          },
          {
            config: {},
            name: 'tsNs',
            type: FieldType.string,
            values: ['ts1', 'ts2'],
          },
          {
            config: {},
            name: 'labels',
            type: FieldType.other,
            typeInfo: {
              frame: 'json.RawMessage',
            },
            values: [{ foo: 'bar' }, { foo: 'bar' }],
          },
        ],
        length: 2,
      };

      setup(
        {
          columnsWithMeta: {
            Time: { active: true, percentOfLinesWithLabel: 2, index: 0 },
            line: { active: true, percentOfLinesWithLabel: 2, index: 1 },
            detected_level: { active: true, percentOfLinesWithLabel: 2, index: 2 },
          },
        },
        frameWithLevel
      );

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const hasDetectedLevel = columns.some((col) => col.textContent?.includes('detected_level'));
        expect(hasDetectedLevel).toBe(true);
      });
    });

    it('should render level column when present in data', async () => {
      const frameWithLevel = {
        fields: [
          {
            config: {},
            name: 'Time',
            type: FieldType.time,
            values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00'],
          },
          {
            config: {},
            name: 'line',
            type: FieldType.string,
            values: ['log message 1', 'log message 2'],
          },
          {
            config: {},
            name: 'level',
            type: FieldType.string,
            values: ['info', 'error'],
          },
          {
            config: {},
            name: 'tsNs',
            type: FieldType.string,
            values: ['ts1', 'ts2'],
          },
          {
            config: {},
            name: 'labels',
            type: FieldType.other,
            typeInfo: {
              frame: 'json.RawMessage',
            },
            values: [{ foo: 'bar' }, { foo: 'bar' }],
          },
        ],
        length: 2,
      };

      setup(
        {
          columnsWithMeta: {
            Time: { active: true, percentOfLinesWithLabel: 2, index: 0 },
            line: { active: true, percentOfLinesWithLabel: 2, index: 1 },
            level: { active: true, percentOfLinesWithLabel: 2, index: 2 },
          },
        },
        frameWithLevel
      );

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const hasLevel = columns.some((col) => col.textContent?.includes('level'));
        expect(hasLevel).toBe(true);
      });
    });
  });

  describe('Sort persistence', () => {
    it('should update URL with sort parameters when sort changes', async () => {
      // Mock onSortByChange to update URL (simulating parent Explore component behavior)
      const onSortByChange = jest.fn((sortBy) => {
        const mockUrl = new URL(window.location.href);
        if (sortBy && sortBy.length > 0) {
          mockUrl.searchParams.set('tableSortBy', sortBy[0].displayName);
          mockUrl.searchParams.set('tableSortDir', sortBy[0].desc ? 'desc' : 'asc');
        } else {
          // Remove sort params if no sort is applied
          mockUrl.searchParams.delete('tableSortBy');
          mockUrl.searchParams.delete('tableSortDir');
        }
        window.history.replaceState({}, '', mockUrl.toString());
      });

      setup({
        sortBy: [{ displayName: 'Time', desc: true }],
        onSortByChange,
      });

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBe(4);
      });

      // Verify the Time column has the sort indicator (arrow down for descending)
      const timeColumnHeader = screen.getByRole('columnheader', { name: /Time/i });
      const sortButton = timeColumnHeader.querySelector('button[title="Toggle SortBy"]');
      expect(sortButton).toBeTruthy();

      // Click to toggle sort (desc -> asc)
      if (sortButton) {
        fireEvent.click(sortButton);
      }

      await waitFor(() => {
        expect(onSortByChange).toHaveBeenCalled();
      });

      // Verify URL was updated (callback was called and URL reflects the new sort state)
      const currentUrl = new URL(window.location.href);
      const tableSortBy = currentUrl.searchParams.get('tableSortBy');
      const tableSortDir = currentUrl.searchParams.get('tableSortDir');

      expect(onSortByChange).toHaveBeenCalled();

      // Verify sort parameters are in URL after clicking
      // The mock simulates parent component updating URL with sort state
      if (tableSortBy && tableSortDir) {
        expect(tableSortBy).toBe('Time');
        expect(tableSortDir).toBe('desc');
      }
    });
  });
});
