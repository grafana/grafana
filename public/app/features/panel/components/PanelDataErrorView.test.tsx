import { render, screen } from '@testing-library/react';
import { defaultsDeep } from 'lodash';
import { Provider } from 'react-redux';

import { CoreApp, FieldType, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { config, PanelDataErrorViewProps } from '@grafana/runtime';
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

const mockUsePanelContext = usePanelContext as jest.Mock;

const RUN_QUERY_MESSAGE = 'Run a query to visualize it here or go to all visualizations to add other panel types';

describe('PanelDataErrorView', () => {
  beforeEach(() => {
    mockUsePanelContext.mockReturnValue({
      app: CoreApp.Dashboard,
      eventBus: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });
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

  it('should show "Run a query..." message when no query is configured and feature toggle is enabled', () => {
    mockUsePanelContext.mockReturnValue({
      app: CoreApp.PanelEditor,
      eventBus: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const originalFeatureToggle = config.featureToggles.newVizSuggestions;
    config.featureToggles.newVizSuggestions = true;

    renderWithProps({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: getDefaultTimeRange(),
        request: {
          targets: [],
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    });

    expect(screen.getByText(RUN_QUERY_MESSAGE)).toBeInTheDocument();

    config.featureToggles.newVizSuggestions = originalFeatureToggle;
  });

  it('should show "No data" message when feature toggle is disabled even without queries', () => {
    mockUsePanelContext.mockReturnValue({
      app: CoreApp.PanelEditor,
      eventBus: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const originalFeatureToggle = config.featureToggles.newVizSuggestions;
    config.featureToggles.newVizSuggestions = false;

    renderWithProps({
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: getDefaultTimeRange(),
        request: {
          targets: [],
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    });

    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.queryByText(RUN_QUERY_MESSAGE)).not.toBeInTheDocument();

    config.featureToggles.newVizSuggestions = originalFeatureToggle;
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
