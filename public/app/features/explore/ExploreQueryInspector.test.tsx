import { render, screen, fireEvent } from '@testing-library/react';
import React, { ComponentProps } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Observable } from 'rxjs';

import { LoadingState, InternalTimeZones, getDefaultTimeRange } from '@grafana/data';
import { InspectorStream } from 'app/core/services/backend_srv';

import { ExploreQueryInspector } from './ExploreQueryInspector';

type ExploreQueryInspectorProps = ComponentProps<typeof ExploreQueryInspector>;

jest.mock('../inspector/styles', () => ({
  getPanelInspectorStyles: () => ({}),
  getPanelInspectorStyles2: () => ({}),
}));

jest.mock('app/core/services/backend_srv', () => ({
  backendSrv: {
    getInspectorStream: () =>
      new Observable((subscriber) => {
        subscriber.next(response());
        subscriber.next(response(true));
      }),
  },
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: ComponentProps<typeof AutoSizer>) {
      return <div>{props.children({ height: 1000, width: 1000, scaledHeight: 1000, scaledWidth: 1000 })}</div>;
    },
  };
});

const setup = (propOverrides = {}) => {
  const props: ExploreQueryInspectorProps = {
    width: 100,
    exploreId: 'left',
    onClose: jest.fn(),
    timeZone: InternalTimeZones.utc,
    isMixed: false,
    queryResponse: {
      state: LoadingState.Done,
      series: [],
      timeRange: getDefaultTimeRange(),
      graphFrames: [],
      logsFrames: [],
      tableFrames: [],
      traceFrames: [],
      customFrames: [],
      nodeGraphFrames: [],
      flameGraphFrames: [],
      rawPrometheusFrames: [],
      graphResult: null,
      logsResult: null,
      tableResult: null,
      rawPrometheusResult: null,
    },
    runQueries: jest.fn(),
    ...propOverrides,
  };

  return render(<ExploreQueryInspector {...props} />);
};

describe('ExploreQueryInspector', () => {
  it('should render closable drawer component', () => {
    setup();
    expect(screen.getByLabelText(/close query inspector/i)).toBeInTheDocument();
  });
  it('should render 4 Tabs if queryResponse has no error', () => {
    setup();
    expect(screen.getAllByLabelText(/tab/i)).toHaveLength(4);
  });
  it('should render 5 Tabs if queryResponse has error', () => {
    setup({ queryResponse: { error: 'Bad gateway' } });
    expect(screen.getAllByLabelText(/tab/i)).toHaveLength(5);
  });
  it('should display query data when click on expanding', () => {
    setup();
    fireEvent.click(screen.getByLabelText(/tab query/i));
    fireEvent.click(screen.getByText(/expand all/i));
    expect(screen.getByText(/very unique test value/i)).toBeInTheDocument();
  });
  it('should display formatted data', () => {
    setup({
      queryResponse: {
        state: LoadingState.Done,
        series: [
          {
            refId: 'A',
            fields: [
              {
                name: 'time',
                type: 'time',
                typeInfo: {
                  frame: 'time.Time',
                  nullable: true,
                },
                config: {
                  interval: 30000,
                },
                values: [1704285124682, 1704285154682],
                entities: {},
              },
              {
                name: 'A-series',
                type: 'number',
                typeInfo: {
                  frame: 'float64',
                  nullable: true,
                },
                labels: {},
                config: {},
                values: [71.202732378676928, 72.348839082431916],
                entities: {},
              },
            ],
            length: 2,
          },
        ],
      },
    });

    fireEvent.click(screen.getByLabelText(/tab data/i));
    // assert series values are formatted to 3 digits (xx.x or x.xx)
    expect(screen.getByText(/71.2/i)).toBeInTheDocument();
    expect(screen.getByText(/72.3/i)).toBeInTheDocument();
    // assert timestamps are formatted
    expect(screen.getByText(/2024-01-03 12:32:04.682/i)).toBeInTheDocument();
    expect(screen.getByText(/2024-01-03 12:32:34.682/i)).toBeInTheDocument();
  });
});

const response = (hideFromInspector = false): InspectorStream => {
  return {
    response: {
      status: 1,
      statusText: '',
      ok: true,
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      data: {
        test: {
          testKey: 'Very unique test value',
        },
      },
      config: {
        url: '',
        hideFromInspector,
      },
    },
    requestId: 'explore_left',
  };
};
