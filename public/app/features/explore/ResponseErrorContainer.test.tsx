import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { DataQueryError, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { configureStore } from '../../store/configureStore';

import { ResponseErrorContainer } from './ResponseErrorContainer';
import { createEmptyQueryResponse, makeExplorePaneState } from './state/utils';

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
  store.getState().explore.panes = {
    left: {
      ...makeExplorePaneState(),
      queryResponse: {
        ...createEmptyQueryResponse(),
        state: LoadingState.Error,
        error,
      },
    },
  };

  render(
    <TestProvider store={store}>
      <ResponseErrorContainer exploreId="left" />
    </TestProvider>
  );
}
