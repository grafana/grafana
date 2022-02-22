import { setupExplore } from './helper/exploreSetup';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeLogsQueryResponse } from './helper/query';

describe('Explore: Query History', () => {
  function inputQuery(query: string) {
    const input = screen.getByRole('textbox', { name: 'query' });
    userEvent.type(input, query);
  }
  function runQuery() {
    const button = screen.getByTestId('data-testid RefreshPicker run button');
    userEvent.click(button);
  }
  function openQueryHistory() {
    const button = screen.getByRole('button', { name: 'Rich history button' });
    userEvent.click(button);
  }

  function assertQueryHistoryExists() {
    expect(screen.getByText('1 queries')).toBeInTheDocument();
    const queryItem = screen.getByLabelText('Query text');
    expect(queryItem).toHaveTextContent('{"expr":"my query"}');
  }

  it('Adds new query history items after the query is run.', async () => {
    // Needed for AutoSizer to work in test
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 500 });

    const { unmount, datasources } = setupExplore();
    (datasources.loki.query as jest.Mock).mockReturnValueOnce(makeLogsQueryResponse());
    await screen.findByText(/Editor/i);

    inputQuery('my query');

    runQuery();
    openQueryHistory();

    await waitFor(() => {
      expect(screen.getByTestId('richHistory')).toBeInTheDocument();
    });

    assertQueryHistoryExists();

    unmount();
    setupExplore({ clearLocalStorage: false });
    await screen.findByText(/Editor/i);
    openQueryHistory();
    assertQueryHistoryExists();
  });
});
