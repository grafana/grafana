import { render, screen, fireEvent } from '@testing-library/react';
import React, { ComponentProps } from 'react';
import { Observable } from 'rxjs';

import { TimeRange, LoadingState, InternalTimeZones } from '@grafana/data';
import { ExploreId } from 'app/types';

import { ExploreQueryInspector } from './ExploreQueryInspector';

type ExploreQueryInspectorProps = ComponentProps<typeof ExploreQueryInspector>;

jest.mock('../inspector/styles', () => ({
  getPanelInspectorStyles: () => ({}),
}));

jest.mock('app/core/services/backend_srv', () => ({
  backendSrv: {
    getInspectorStream: () =>
      new Observable((subscriber) => {
        subscriber.next(response());
        subscriber.next(response(true));
      }) as any,
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

const setup = (propOverrides = {}) => {
  const props: ExploreQueryInspectorProps = {
    loading: false,
    width: 100,
    exploreId: ExploreId.left,
    onClose: jest.fn(),
    timeZone: InternalTimeZones.utc,
    queryResponse: {
      state: LoadingState.Done,
      series: [],
      timeRange: {} as TimeRange,
      graphFrames: [],
      logsFrames: [],
      tableFrames: [],
      traceFrames: [],
      nodeGraphFrames: [],
      flameGraphFrames: [],
      graphResult: null,
      logsResult: null,
      tableResult: null,
    },
    runQueries: jest.fn(),
    ...propOverrides,
  };

  return render(<ExploreQueryInspector {...props} />);
};

describe('ExploreQueryInspector', () => {
  it('should render closable drawer component', () => {
    setup();
    expect(screen.getByTitle(/close query inspector/i)).toBeInTheDocument();
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
});

const response = (hideFromInspector = false) => ({
  status: 1,
  statusText: '',
  ok: true,
  headers: {} as any,
  redirected: false,
  type: 'basic',
  url: '',
  request: {} as any,
  data: {
    test: {
      testKey: 'Very unique test value',
    },
  },
  config: {
    url: '',
    hideFromInspector,
  },
});
