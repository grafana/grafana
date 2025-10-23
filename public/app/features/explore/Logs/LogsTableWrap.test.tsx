import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ComponentProps } from 'react';

import { createTheme, ExploreLogsPanelState, LogsSortOrder, toUtc } from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { config } from '@grafana/runtime';

import { extractFieldsTransformer } from '../../transformers/extractFields/extractFields';

import { LogsTableWrap } from './LogsTableWrap';
import { getMockLokiFrame, getMockLokiFrameDataPlane } from './utils/mocks';

const getComponent = (partialProps?: Partial<ComponentProps<typeof LogsTableWrap>>) => {
  return (
    <LogsTableWrap
      range={{
        from: toUtc('2019-01-01 10:00:00'),
        to: toUtc('2019-01-01 16:00:00'),
        raw: { from: 'now-1h', to: 'now' },
      }}
      onClickFilterOutLabel={() => undefined}
      onClickFilterLabel={() => undefined}
      updatePanelState={() => undefined}
      panelState={undefined}
      logsSortOrder={LogsSortOrder.Descending}
      splitOpen={() => undefined}
      timeZone={'utc'}
      width={50}
      logsFrames={[getMockLokiFrame()]}
      theme={createTheme()}
      {...partialProps}
    />
  );
};
const setup = (partialProps?: Partial<ComponentProps<typeof LogsTableWrap>>) => {
  return render(getComponent(partialProps));
};

describe('LogsTableWrap', () => {
  beforeAll(() => {
    const transformers = [extractFieldsTransformer, organizeFieldsTransformer];
    mockTransformationsRegistry(transformers);
  });

  it('should render 4 table rows', async () => {
    setup();

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // tableFrame has 3 rows + 1 header row
      expect(rows.length).toBe(4);
    });
  });

  it('should render 4 table rows (dataplane)', async () => {
    config.featureToggles.lokiLogsDataplane = true;
    setup({ logsFrames: [getMockLokiFrameDataPlane()] });

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // tableFrame has 3 rows + 1 header row
      expect(rows.length).toBe(4);
    });
  });

  it('updatePanelState should be called when a column is selected', async () => {
    const updatePanelState = jest.fn<void, [Partial<ExploreLogsPanelState>]>();
    setup({
      panelState: {
        visualisationType: 'table',
        columns: undefined,
      },
      updatePanelState: updatePanelState,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('app')).toBeInTheDocument();
    });

    // Add a new column
    act(() => {
      screen.getByLabelText('app').click();
    });

    await waitFor(() => {
      expect(updatePanelState).toHaveBeenCalled();
    });

    // Find the call that includes 'app' in columns
    const callWithApp = updatePanelState.mock.calls.find((call) => {
      const cols = call[0].columns;
      return cols && typeof cols === 'object' && Object.values(cols).includes('app');
    });

    expect(callWithApp).toBeDefined();
    if (callWithApp) {
      const { columns, displayedFields } = callWithApp[0];
      // Should have Time, Line, and app columns
      expect(Object.values(columns as Record<number, string>)).toContain('Time');
      expect(Object.values(columns as Record<number, string>)).toContain('Line');
      expect(Object.values(columns as Record<number, string>)).toContain('app');
      // displayedFields should contain 'app' but not default columns
      expect(displayedFields).toContain('app');
    }

    // Remove the same column
    act(() => {
      screen.getByLabelText('app').click();
    });

    await waitFor(() => {
      // Should have been called again after removal
      const callCount = updatePanelState.mock.calls.length;
      expect(callCount).toBeGreaterThan(callWithApp ? updatePanelState.mock.calls.indexOf(callWithApp) + 1 : 0);
    });

    // Find the call after removal (last call should not have 'app')
    const lastCall = updatePanelState.mock.calls[updatePanelState.mock.calls.length - 1];
    const { columns: finalColumns, displayedFields: finalDisplayedFields } = lastCall[0];

    // Should only have Time and Line (no 'app')
    expect(Object.values(finalColumns as Record<number, string>)).toContain('Time');
    expect(Object.values(finalColumns as Record<number, string>)).toContain('Line');
    expect(Object.values(finalColumns as Record<number, string>)).not.toContain('app');
    // displayedFields should be empty or not contain 'app'
    if (finalDisplayedFields) {
      expect(finalDisplayedFields).not.toContain('app');
    }
  });

  it('search input should search matching columns', async () => {
    config.featureToggles.lokiLogsDataplane = false;
    const updatePanelState = jest.fn<void, [Partial<ExploreLogsPanelState>]>();
    setup({
      panelState: {
        visualisationType: 'table',
        columns: undefined,
      },
      updatePanelState: updatePanelState,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('app')).toBeInTheDocument();
      expect(screen.getByLabelText('cluster')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search fields by name');
    fireEvent.change(searchInput, { target: { value: 'app' } });

    expect(screen.getByLabelText('app')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('cluster')).not.toBeInTheDocument();
    });
  });

  it('should update selected dataframe when dataFrames update', async () => {
    const initialProps = { logsFrames: [getMockLokiFrameDataPlane(undefined, 3)] };
    const render = setup(initialProps);
    await waitFor(() => {
      const rows = render.getAllByRole('row');
      expect(rows.length).toBe(4);
    });

    render.rerender(
      getComponent({
        ...initialProps,
        logsFrames: [getMockLokiFrameDataPlane(undefined, 4)],
      })
    );

    await waitFor(() => {
      const rows = render.getAllByRole('row');
      expect(rows.length).toBe(5);
    });
  });

  it('search input should search matching columns (dataplane)', async () => {
    config.featureToggles.lokiLogsDataplane = true;

    const updatePanelState = jest.fn<void, [Partial<ExploreLogsPanelState>]>();
    setup({
      panelState: {},
      updatePanelState: updatePanelState,
      logsFrames: [getMockLokiFrameDataPlane()],
    });

    await waitFor(() => {
      expect(screen.getByLabelText('app')).toBeInTheDocument();
      expect(screen.getByLabelText('cluster')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search fields by name');
    fireEvent.change(searchInput, { target: { value: 'app' } });

    expect(screen.getByLabelText('app')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('cluster')).not.toBeInTheDocument();
    });
  });

  describe('displayedFields syncing', () => {
    it('should activate fields from displayedFields in panelState', async () => {
      const updatePanelState = jest.fn<void, [Partial<ExploreLogsPanelState>]>();
      setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: ['app', 'cluster'],
          columns: ['Time', 'Line', 'app', 'cluster'],
        },
        updatePanelState,
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');

        // Should show default columns (Time, Line) and custom fields from displayedFields
        expect(columnText).toContain('Time');
        expect(columnText).toContain('Line');
        expect(columnText).toContain('app');
        expect(columnText).toContain('cluster');
      });

      // Verify the checkboxes for displayedFields are checked
      const appCheckbox = screen.getByLabelText('app');
      const clusterCheckbox = screen.getByLabelText('cluster');
      expect(appCheckbox).toBeChecked();
      expect(clusterCheckbox).toBeChecked();
    });

    it('should populate columns from displayedFields in panelState', async () => {
      const updatePanelState = jest.fn<void, [Partial<ExploreLogsPanelState>]>();
      setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: ['app', 'cluster'],
          columns: ['Time', 'Line', 'app', 'cluster'],
        },
        updatePanelState,
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');

        // Should show default columns (Time, Line) and custom fields from displayedFields
        expect(columnText).toContain('Time');
        expect(columnText).toContain('Line');
        expect(columnText).toContain('app');
        expect(columnText).toContain('cluster');
      });
    });

    it('should show only default columns when displayedFields is empty', async () => {
      setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: [],
          columns: ['Time', 'Line'],
        },
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');

        // Should only show defaults (Time, Line)
        expect(columnText).toContain('Time');
        expect(columnText).toContain('Line');

        // Custom fields should not be visible
        const hasApp = columns.some((col) => col.textContent?.includes('app') && !col.textContent?.includes('Time'));
        const hasCluster = columns.some((col) => col.textContent?.includes('cluster'));
        expect(hasApp).toBe(false);
        expect(hasCluster).toBe(false);
      });
    });

    it('should merge displayedFields with default columns', async () => {
      setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: ['app'],
          columns: ['Time', 'Line', 'app'],
        },
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');

        // Should have defaults and custom field
        expect(columnText).toContain('Time');
        expect(columnText).toContain('Line');
        expect(columnText).toContain('app');
      });
    });

    it('should reset to defaults when displayedFields is cleared', async () => {
      const updatePanelState = jest.fn<void, [Partial<ExploreLogsPanelState>]>();

      // Start with custom displayedFields
      const { rerender } = setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: ['app', 'cluster'],
          columns: ['Time', 'Line', 'app', 'cluster'],
        },
        updatePanelState,
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');
        expect(columnText).toContain('app');
        expect(columnText).toContain('cluster');
      });

      // Simulate clearing displayedFields (like clicking "Show original line")
      rerender(
        getComponent({
          panelState: {
            visualisationType: 'table',
            displayedFields: [],
            columns: ['Time', 'Line'],
          },
          updatePanelState,
        })
      );

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');

        // Should show defaults
        expect(columnText).toContain('Time');
        expect(columnText).toContain('Line');

        // Custom fields should be gone
        const hasApp = columns.some((col) => col.textContent?.includes('app') && !col.textContent?.includes('Time'));
        const hasCluster = columns.some((col) => col.textContent?.includes('cluster'));
        expect(hasApp).toBe(false);
        expect(hasCluster).toBe(false);
      });
    });

    it('should call updatePanelState when columns change via displayedFields', async () => {
      const updatePanelState = jest.fn<void, [Partial<ExploreLogsPanelState>]>();

      setup({
        panelState: {
          visualisationType: 'table',
        },
        updatePanelState,
      });

      // Wait for initial render and default columns setup
      await waitFor(() => {
        expect(updatePanelState).toHaveBeenCalled();
      });

      // Verify updatePanelState was called with column configuration
      expect(updatePanelState).toHaveBeenCalledWith(
        expect.objectContaining({
          visualisationType: 'table',
        })
      );
    });

    it('should handle displayedFields with only custom fields', async () => {
      setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: ['container'],
          columns: ['Time', 'Line', 'container'],
        },
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');

        // Should have defaults plus the single custom field
        expect(columnText).toContain('Time');
        expect(columnText).toContain('Line');
        expect(columnText).toContain('container');
      });
    });
  });

  describe('getColumnsFromDisplayedFields syncing displayedFields and columns', () => {
    it('should filter out default columns from displayedFields when updating panelState', async () => {
      const updatePanelState = jest.fn<void, [Partial<ExploreLogsPanelState>]>();
      setup({
        panelState: {
          visualisationType: 'table',
          columns: undefined,
        },
        updatePanelState,
      });

      await waitFor(() => {
        expect(screen.getByLabelText('app')).toBeInTheDocument();
      });

      // Add a custom column
      act(() => {
        screen.getByLabelText('app').click();
      });

      await waitFor(() => {
        expect(updatePanelState).toHaveBeenCalled();
      });

      // Find the call that includes displayedFields
      const callsWithDisplayedFields = updatePanelState.mock.calls.find(
        (call) => call[0].displayedFields !== undefined
      );

      expect(callsWithDisplayedFields).toBeDefined();
      if (callsWithDisplayedFields) {
        const { displayedFields } = callsWithDisplayedFields[0];
        // displayedFields should only contain 'app', not default columns (Time, Line)
        expect(displayedFields).toContain('app');
        expect(displayedFields).not.toContain('Time');
        expect(displayedFields).not.toContain('Line');
      }
    });

    it('should sync displayedFields from panelState on initial render', async () => {
      setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: ['app', 'container'],
          columns: ['Time', 'Line', 'app', 'container'],
        },
      });

      await waitFor(() => {
        // Verify that columns from displayedFields are rendered
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');

        expect(columnText).toContain('app');
        expect(columnText).toContain('container');
      });

      // Verify checkboxes are checked for displayedFields
      expect(screen.getByLabelText('app')).toBeChecked();
      expect(screen.getByLabelText('container')).toBeChecked();
    });

    it('should preserve column order from displayedFields', async () => {
      setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: ['cluster', 'app', 'container'],
          columns: ['Time', 'Line', 'cluster', 'app', 'container'],
        },
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnTexts = Array.from(columns).map((col) => col.textContent);

        // Find indices of custom fields
        const clusterIndex = columnTexts.findIndex((text) => text?.includes('cluster'));
        const appIndex = columnTexts.findIndex((text) => text?.includes('app') && !text?.includes('Time'));
        const containerIndex = columnTexts.findIndex((text) => text?.includes('container'));

        // Verify they appear in the order specified in displayedFields
        // (after default columns Time and Line)
        expect(clusterIndex).toBeGreaterThan(-1);
        expect(appIndex).toBeGreaterThan(-1);
        expect(containerIndex).toBeGreaterThan(-1);
        expect(clusterIndex).toBeLessThan(appIndex);
        expect(appIndex).toBeLessThan(containerIndex);
      });
    });

    it('should handle empty displayedFields array', async () => {
      setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: [],
          columns: ['Time', 'Line'],
        },
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');

        // Should only show default columns
        expect(columnText).toContain('Time');
        expect(columnText).toContain('Line');
      });

      // Custom fields should not be checked
      expect(screen.getByLabelText('app')).not.toBeChecked();
      expect(screen.getByLabelText('cluster')).not.toBeChecked();
    });

    it('should handle displayedFields with fields that do not exist in frame', async () => {
      setup({
        panelState: {
          visualisationType: 'table',
          displayedFields: ['nonexistent', 'app'],
          columns: ['Time', 'Line', 'app'],
        },
      });

      await waitFor(() => {
        const columns = screen.getAllByRole('columnheader');
        const columnText = columns.map((col) => col.textContent).join(' ');

        // Should show defaults and valid fields
        expect(columnText).toContain('Time');
        expect(columnText).toContain('Line');
        expect(columnText).toContain('app');
        // Should not show nonexistent field
        expect(columnText).not.toContain('nonexistent');
      });
    });
  });
});
