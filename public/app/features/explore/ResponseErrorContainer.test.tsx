import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { DataQueryError, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { configureStore } from '../../store/configureStore';

import { ResponseErrorContainer } from './ResponseErrorContainer';
import { createEmptyQueryResponse, makeExplorePaneState } from './state/utils';

describe('ResponseErrorContainer', () => {
  describe('LoadingState.Error', () => {
    it('shows error message if it does not contain refId', async () => {
      const errorMessage = 'test error';
      setup({ state: LoadingState.Error, error: { message: errorMessage } });
      const errorEl = screen.getByTestId(selectors.components.Alert.alertV2('error'));
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveTextContent(errorMessage);
    });

    it('does not show error if there is a refId', async () => {
      setup({ state: LoadingState.Error, error: { refId: 'someId', message: 'test error' } });
      expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
    });

    it('shows error.data.message if error.message does not exist', async () => {
      setup({ state: LoadingState.Error, error: { data: { message: 'test error' } } });
      const errorEl = screen.getByTestId(selectors.components.Alert.alertV2('error'));
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveTextContent('test error');
    });
  });

  describe('LoadingState.Done — partial failure', () => {
    it('shows error from errors[] when state is Done and error has no refId', async () => {
      const errorMessage = 'expression failed';
      setup({ state: LoadingState.Done, errors: [{ message: errorMessage }] });
      const errorEl = screen.getByTestId(selectors.components.Alert.alertV2('error'));
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveTextContent(errorMessage);
    });

    it('does not show error when all errors in errors[] have a refId', async () => {
      setup({ state: LoadingState.Done, errors: [{ refId: 'A', message: 'query error' }] });
      expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
    });

    it('does not show error when Done with no errors', async () => {
      setup({ state: LoadingState.Done });
      expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
    });
  });
});

function setup({ state, error, errors }: { state: LoadingState; error?: DataQueryError; errors?: DataQueryError[] }) {
  const store = configureStore();
  store.getState().explore.panes = {
    left: {
      ...makeExplorePaneState(),
      queryResponse: {
        ...createEmptyQueryResponse(),
        state,
        error,
        errors,
      },
    },
  };

  render(
    <TestProvider store={store}>
      <ResponseErrorContainer exploreId="left" />
    </TestProvider>
  );
}
