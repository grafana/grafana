import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { DataQueryError, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { configureStore } from '../../store/configureStore';
import { ExploreId } from '../../types';

import { ResponseErrorContainer } from './ResponseErrorContainer';

describe('ResponseErrorContainer', () => {
  it('shows error message if it does not contain refId', async () => {
    const errorMessage = 'test error';
    setup({
      message: errorMessage,
    });
    const errorEl = screen.getByTestId(selectors.components.Alert.alertV2('error'));
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent(errorMessage);
  });

  it('shows error if there is refID', async () => {
    const errorMessage = 'test error';
    setup({
      refId: 'someId',
      message: errorMessage,
    });
    const errorEl = screen.getByTestId(selectors.components.Alert.alertV2('error'));
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent(errorMessage);
  });

  it('shows error.data.message if error.message does not exist', async () => {
    const errorMessage = 'test error';
    setup({
      data: {
        message: 'test error',
      },
    });
    const errorEl = screen.getByTestId(selectors.components.Alert.alertV2('error'));
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent(errorMessage);
  });
});

function setup(error: DataQueryError) {
  const store = configureStore();
  store.getState().explore[ExploreId.left].queryResponse = {
    timeRange: {} as any,
    series: [],
    state: LoadingState.Error,
    error,
    graphFrames: [],
    logsFrames: [],
    tableFrames: [],
    traceFrames: [],
    nodeGraphFrames: [],
    graphResult: null,
    logsResult: null,
    tableResult: null,
  };
  render(
    <Provider store={store}>
      <ResponseErrorContainer exploreId={ExploreId.left} />
    </Provider>
  );
}
