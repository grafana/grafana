import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ComponentProps } from 'react';

import { type ExploreLogsPanelState, LogsSortOrder, toUtc } from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';

import { extractFieldsTransformer } from '../../transformers/extractFields/extractFields';

import { LogsTableWrap } from './LogsTableWrap';
import { getMockLokiFrame, getMockLokiFrameDataPlane } from './utils/mocks';

const useBooleanFlagValueMock = jest.fn((_: string, defaultValue: boolean) => defaultValue);

const setBooleanFlags = (flags: Record<string, boolean>) => {
  useBooleanFlagValueMock.mockImplementation((flag: string, defaultValue: boolean) => {
    return Object.prototype.hasOwnProperty.call(flags, flag) ? flags[flag] : defaultValue;
  });
};

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: (flag: string, defaultValue: boolean) => useBooleanFlagValueMock(flag, defaultValue),
}));

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
      {...partialProps}
    />
  );
};
const setup = (partialProps?: Partial<ComponentProps<typeof LogsTableWrap>>) => {
  return render(getComponent(partialProps));
};

describe('LogsTableWrap', () => {
  beforeEach(() => {
    setBooleanFlags({});
  });

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
    setBooleanFlags({ lokiLogsDataplane: true });
    setup({ logsFrames: [getMockLokiFrameDataPlane()] });

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // tableFrame has 3 rows + 1 header row
      expect(rows.length).toBe(4);
    });
  });

  it('updatePanelState should be called when a column is selected', async () => {
    const updatePanelState = jest.fn() as (panelState: Partial<ExploreLogsPanelState>) => void;
    setup({
      panelState: {
        visualisationType: 'table',
        columns: undefined,
      },
      updatePanelState: updatePanelState,
    });

    expect.assertions(3);

    expect(screen.getByLabelText('app')).toBeInTheDocument();

    // Add a new column
    act(() => {
      screen.getByLabelText('app').click();
    });

    await waitFor(() => {
      expect(updatePanelState).toBeCalledWith({
        visualisationType: 'table',
        columns: { 0: 'app', 1: 'Line', 2: 'Time' },
        labelFieldName: 'labels',
      });
    });

    // Remove the same column
    act(() => {
      screen.getByLabelText('app').click();
    });

    await waitFor(() => {
      expect(updatePanelState).toBeCalledWith({
        visualisationType: 'table',
        columns: { 0: 'Line', 1: 'Time' },
        labelFieldName: 'labels',
      });
    });
  });

  it('search input should search matching columns', async () => {
    setBooleanFlags({ lokiLogsDataplane: false });
    const updatePanelState = jest.fn() as (panelState: Partial<ExploreLogsPanelState>) => void;
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
    setBooleanFlags({ lokiLogsDataplane: true });

    const updatePanelState = jest.fn() as (panelState: Partial<ExploreLogsPanelState>) => void;
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
});
