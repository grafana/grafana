import React from 'react';
import { configureStore } from '../../store/configureStore';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import { ExploreId } from '../../types';
import { DataQueryError, LoadingState } from '@grafana/data';

describe('ResponseErrorContainer', () => {
  it('shows error message if it does not contain refId', async () => {
    setup({
      message: 'test error',
    });
    expect(screen.getByText('test error')).toBeInTheDocument();
  });

  it('shows error.data.message if error.message does not exist', async () => {
    setup({
      data: {
        message: 'test error',
      },
    });
    expect(screen.getByText('test error')).toBeInTheDocument();
  });

  it('does not show error if there is refID', async () => {
    setup({
      refId: 'someId',
      message: 'test error',
    });
    expect(screen.queryByText('test error')).not.toBeInTheDocument();
  });

  it('does not show error if there is refID', async () => {
    setup({
      refId: 'someId',
      message: 'test error',
    });
    expect(screen.queryByText('test error')).not.toBeInTheDocument();
  });
});

function setup(error: DataQueryError) {
  const store = configureStore();
  store.getState().explore[ExploreId.left].queryResponse = {
    timeRange: {} as any,
    series: [],
    state: LoadingState.Error,
    error,
  };
  render(
    <Provider store={store}>
      <ResponseErrorContainer exploreId={ExploreId.left} />
    </Provider>
  );
}
