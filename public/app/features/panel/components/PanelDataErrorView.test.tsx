import { render, screen } from '@testing-library/react';
import { defaultsDeep } from 'lodash';
import { Provider } from 'react-redux';

import {
  CoreApp,
  type DataQueryRequest,
  EventBusSrv,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  toDataFrame,
} from '@grafana/data';
import { type PanelDataErrorViewProps } from '@grafana/runtime';
import { usePanelContext } from '@grafana/ui';
import { configureStore } from 'app/store/configureStore';

import { PanelDataErrorView } from './PanelDataErrorView';

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => {
    return {
      getCurrent: () => undefined,
    };
  },
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  usePanelContext: jest.fn(),
}));

const mockUsePanelContext = jest.mocked(usePanelContext);
const RUN_QUERY_MESSAGE = 'Run a query to visualize it here or go to all visualizations to add other panel types';
const panelContextRoot = {
  app: CoreApp.Dashboard,
  eventsScope: 'global',
  eventBus: new EventBusSrv(),
};
const panelContextEditor = {
  app: CoreApp.PanelEditor,
  eventsScope: 'global',
  eventBus: new EventBusSrv(),
};

describe('PanelDataErrorView', () => {
  beforeEach(() => {
    mockUsePanelContext.mockReturnValue(panelContextRoot);
  });

  it('show No data when there is no data', () => {
    renderWithProps();

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('show No data when there is no data', () => {
    renderWithProps({
      data: {
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        series: [
          {
            fields: [
              {
                name: 'time',
                type: FieldType.time,
                config: {},
                values: [],
              },
            ],
            length: 0,
          },
          {
            fields: [
              {
                name: 'value',
                type: FieldType.number,
                config: {},
                values: [],
              },
            ],
            length: 0,
          },
        ],
      },
    });

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('show no value field config when there is no data', () => {
    renderWithProps({
      fieldConfig: {
        overrides: [],
        defaults: {
          noValue: 'Query returned nothing',
        },
      },
    });

    expect(screen.getByText('Query returned nothing')).toBeInTheDocument();
  });

  it('should show "Run a query..." message when no query is configured in panel editor', () => {
    mockUsePanelContext.mockReturnValue(panelContextEditor);

    const { container } = renderWithProps({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: getDefaultTimeRange(),
      },
    });

    expect(screen.getByText(RUN_QUERY_MESSAGE)).toBeInTheDocument();
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should show "No data" message when not in panel editor', () => {
    mockUsePanelContext.mockReturnValue(panelContextRoot);

    renderWithProps({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: getDefaultTimeRange(),
      },
    });

    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.queryByText(RUN_QUERY_MESSAGE)).not.toBeInTheDocument();
  });

  it('should show "No data" message in panel editor when query is configured', () => {
    mockUsePanelContext.mockReturnValue(panelContextEditor);

    renderWithProps({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: getDefaultTimeRange(),
        request: {
          targets: [{ refId: 'A' }],
        } as unknown as DataQueryRequest,
      },
    });

    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.queryByText(RUN_QUERY_MESSAGE)).not.toBeInTheDocument();
  });
});

describe('missing field messages', () => {
  it('shows "Data is missing a time field" when only time is absent', () => {
    renderWithProps({
      needsTimeField: true,
      needsStringField: true,
      data: {
        state: LoadingState.Done,
        series: [
          toDataFrame({
            fields: [{ name: 'message', type: FieldType.string, values: ['a'] }],
          }),
        ],
        timeRange: getDefaultTimeRange(),
      },
    });

    expect(screen.getByText('Data is missing a time field')).toBeInTheDocument();
  });

  it('shows combined message when both time and string are absent', () => {
    renderWithProps({
      needsTimeField: true,
      needsStringField: true,
      data: {
        state: LoadingState.Done,
        series: [
          toDataFrame({
            fields: [{ name: 'count', type: FieldType.number, values: [1, 2] }],
          }),
        ],
        timeRange: getDefaultTimeRange(),
      },
    });

    expect(screen.getByText('Data is missing time and string fields')).toBeInTheDocument();
  });

  it('shows "Data is missing a string field" when only string is absent', () => {
    renderWithProps({
      needsStringField: true,
      data: {
        state: LoadingState.Done,
        series: [
          toDataFrame({
            fields: [{ name: 'timestamp', type: FieldType.time, values: [1] }],
          }),
        ],
        timeRange: getDefaultTimeRange(),
      },
    });

    expect(screen.getByText('Data is missing a string field')).toBeInTheDocument();
  });

  it('shows combined message when all three field types are absent', () => {
    renderWithProps({
      needsTimeField: true,
      needsStringField: true,
      needsNumberField: true,
      data: {
        state: LoadingState.Done,
        series: [
          toDataFrame({
            fields: [{ name: 'flag', type: FieldType.boolean, values: [true] }],
          }),
        ],
        timeRange: getDefaultTimeRange(),
      },
    });

    expect(screen.getByText('Data is missing time, string, and number fields')).toBeInTheDocument();
  });
});

function renderWithProps(overrides?: Partial<PanelDataErrorViewProps>) {
  const defaults: PanelDataErrorViewProps = {
    panelId: 1,
    data: {
      state: LoadingState.Done,
      series: [],
      timeRange: getDefaultTimeRange(),
    },
  };

  const props = defaultsDeep(overrides ?? {}, defaults);
  const store = configureStore();

  const stuff = render(
    <Provider store={store}>
      <PanelDataErrorView {...props} />
    </Provider>
  );
  return { ...stuff };
}
