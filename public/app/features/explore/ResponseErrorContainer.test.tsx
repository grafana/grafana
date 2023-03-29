import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { DataQueryError, LoadingState, getDefaultTimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { configureStore } from '../../store/configureStore';

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

  it('do not show error if there is a refId', async () => {
    const errorMessage = 'test error';
    setup({
      refId: 'someId',
      message: errorMessage,
    });
    const errorEl = screen.queryByTestId(selectors.components.Alert.alertV2('error'));
    expect(errorEl).not.toBeInTheDocument();
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
  store.getState().explore.panes.left!.queryResponse = {
    timeRange: getDefaultTimeRange(),
    series: [],
    state: LoadingState.Error,
    error,
    graphFrames: [],
    logsFrames: [],
    tableFrames: [],
    traceFrames: [],
    nodeGraphFrames: [],
    rawPrometheusFrames: [],
    flameGraphFrames: [],
    graphResult: null,
    logsResult: null,
    tableResult: null,
    rawPrometheusResult: null,
  };
  render(
    <Provider store={store}>
      <ResponseErrorContainer exploreId={'left'} />
    </Provider>
  );
}
