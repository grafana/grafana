import React, { ComponentProps } from 'react';
import { Observable } from 'rxjs';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeRange, LoadingState } from '@grafana/data';
import { ExploreId } from 'app/types';
import { ExploreQueryInspector } from './ExploreQueryInspector';

type ExploreQueryInspectorProps = ComponentProps<typeof ExploreQueryInspector>;

jest.mock('../dashboard/components/Inspector/styles', () => ({
  getPanelInspectorStyles: () => ({}),
}));

jest.mock('app/core/services/backend_srv', () => ({
  getBackendSrv: () => ({
    getInspectorStream: () =>
      new Observable(subscriber => {
        subscriber.next(response());
        subscriber.next(response(true));
      }) as any,
  }),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

const setup = () => {
  const props: ExploreQueryInspectorProps = {
    loading: false,
    width: 100,
    exploreId: ExploreId.left,
    onClose: jest.fn(),
    queryResponse: {
      state: LoadingState.Done,
      series: [],
      timeRange: {} as TimeRange,
    },
  };

  return render(<ExploreQueryInspector {...props} />);
};

describe('ExploreQueryInspector', () => {
  it('should render closable drawer component', () => {
    setup();
    expect(screen.getByTitle(/close query inspector/i)).toBeInTheDocument();
  });
  it('should render 2 Tabs', () => {
    setup();
    expect(screen.getByLabelText(/tab stats/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tab query inspector/i)).toBeInTheDocument();
  });
  it('should display query data', () => {
    setup();
    fireEvent.click(screen.getByLabelText(/tab query inspector/i));
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
