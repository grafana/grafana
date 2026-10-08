import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';

import { createTheme, EventBusSrv, PanelDiagnosticsStore, ThemeContext, type PanelDiagnostic } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { PanelChrome } from './PanelChrome';
import { PanelContextProvider } from './PanelContext';
import { PanelDiagnosticActions } from './PanelDiagnosticActions';
import { usePanelDiagnostics } from './usePanelDiagnostics';

function Reporter({ items }: { items: readonly PanelDiagnostic[] }) {
  usePanelDiagnostics(items);
  return <div>Visualization</div>;
}

it('renders custom and Assistant actions as solid secondary buttons', () => {
  const theme = createTheme();
  const diagnostics = new PanelDiagnosticsStore();
  diagnostics.createSource().set([
    {
      id: 'field',
      severity: 'error',
      text: 'Choose a field',
      actions: [{ id: 'choose', label: 'Choose field', onClick: jest.fn() }],
    },
  ]);
  render(
    <ThemeContext.Provider value={theme}>
      <PanelContextProvider
        value={{ diagnostics, eventBus: new EventBusSrv(), eventsScope: 'panel', onInvestigateDiagnostic: jest.fn() }}
      >
        <PanelDiagnosticActions diagnostic={diagnostics.getSnapshot().items[0]} />
      </PanelContextProvider>
    </ThemeContext.Provider>
  );
  for (const name of ['Choose field', 'Fix with Assistant']) {
    expect(screen.getByRole('button', { name })).toHaveStyle({
      border: `1px solid ${theme.colors.secondary.subtleBorder}`,
    });
  }
});

it('publishes plugin-only warnings, updates them, and cleans up through Strict Mode', async () => {
  const store = new PanelDiagnosticsStore();
  const context = { diagnostics: store, eventBus: new EventBusSrv(), eventsScope: 'panel' };
  const ui = (items: PanelDiagnostic[]) => (
    <StrictMode>
      <PanelContextProvider value={context}>
        <PanelChrome width={400} height={200} title="My panel">
          {() => <Reporter items={items} />}
        </PanelChrome>
      </PanelContextProvider>
    </StrictMode>
  );
  const { rerender, unmount } = render(ui([{ id: 'field', severity: 'warning', text: 'Choose a field' }]));
  expect(screen.getByText('Visualization')).toBeInTheDocument();
  await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('warning')));
  expect(await screen.findByText('Choose a field')).toBeVisible();
  rerender(ui([{ id: 'field', severity: 'error', text: 'Field removed' }]));
  expect(await screen.findByText('Field removed')).toBeVisible();
  expect(screen.queryByText('Choose a field')).not.toBeInTheDocument();
  act(() => store.clear());
  expect(store.getSnapshot().items.map(({ text }) => text)).toEqual(['Field removed']);
  unmount();
  expect(store.getSnapshot().items).toEqual([]);
});

it('shares callback progress and failures across inspector views, and hides opted-out Assistant actions', async () => {
  const store = new PanelDiagnosticsStore();
  let reject!: (error: Error) => void;
  const onClick = jest.fn(
    () =>
      new Promise<void>((_, rejectPromise) => {
        reject = rejectPromise;
      })
  );
  store.createSource().set([
    {
      id: 'a',
      severity: 'error',
      text: 'Bad config',
      assistant: 'hidden',
      actions: [{ id: 'fix', label: 'Choose field', onClick }],
    },
    { id: 'b', severity: 'warning', text: 'Partial data' },
  ]);
  const [error, warning] = store.getSnapshot().items;
  const onInvestigateDiagnostic = jest.fn();
  render(
    <PanelContextProvider
      value={{ diagnostics: store, eventBus: new EventBusSrv(), eventsScope: 'panel', onInvestigateDiagnostic }}
    >
      <section aria-label="First inspector">
        <PanelDiagnosticActions diagnostic={error} />
        <PanelDiagnosticActions diagnostic={warning} />
      </section>
      <section aria-label="Second inspector">
        <PanelDiagnosticActions diagnostic={error} />
      </section>
    </PanelContextProvider>
  );
  const user = userEvent.setup();
  await user.tab();
  expect(
    within(screen.getByRole('region', { name: 'First inspector' })).getByRole('button', { name: 'Choose field' })
  ).toHaveFocus();
  await user.keyboard('{Enter}');
  for (const button of screen.getAllByRole('button', { name: 'Choose field' })) {
    expect(button).toBeDisabled();
  }
  expect(screen.queryByRole('button', { name: 'Fix with Assistant' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Explain with Assistant' }));
  expect(onInvestigateDiagnostic).toHaveBeenCalledWith(warning.id);
  await act(async () => {
    reject(new Error('Not allowed'));
  });
  expect(screen.getAllByRole('alert').map((element) => element.textContent)).toEqual([
    'Choose field: Not allowed',
    'Choose field: Not allowed',
  ]);
  expect(onClick).toHaveBeenCalledTimes(1);
});
