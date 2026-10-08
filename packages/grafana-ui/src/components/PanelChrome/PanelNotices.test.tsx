import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';

import { createTheme, EventBusSrv, PanelStatusStore, ThemeContext, type PanelNotice } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { PanelChrome } from './PanelChrome';
import { PanelContextProvider } from './PanelContext';
import { PanelStatusActions } from './PanelStatusActions';
import { usePanelNotices } from './usePanelNotices';

function Reporter({ items }: { items: readonly PanelNotice[] }) {
  usePanelNotices(items);
  return <div>Visualization</div>;
}

it('renders normal-sized solid secondary actions separated from the status message', () => {
  const theme = createTheme();
  const notices = new PanelStatusStore();
  notices.createSource().set([
    {
      id: 'field',
      severity: 'error',
      text: 'Choose a field',
      actions: [{ id: 'choose', label: 'Choose field', onClick: jest.fn() }],
    },
  ]);
  const { container } = render(
    <ThemeContext.Provider value={theme}>
      <PanelContextProvider
        value={{ notices, eventBus: new EventBusSrv(), eventsScope: 'panel', onInvestigateStatusItem: jest.fn() }}
      >
        <PanelStatusActions statusItem={notices.getSnapshot().items[0]} />
      </PanelContextProvider>
    </ThemeContext.Provider>
  );
  for (const name of ['Choose field', 'Fix with Assistant']) {
    expect(screen.getByRole('button', { name })).toHaveStyle({
      border: `1px solid ${theme.colors.secondary.subtleBorder}`,
      height: '32px',
    });
  }
  expect(container.firstChild).toHaveStyle({ marginTop: '12px' });
});

it('publishes plugin-only warnings, updates them, and cleans up through Strict Mode', async () => {
  const store = new PanelStatusStore();
  const context = { notices: store, eventBus: new EventBusSrv(), eventsScope: 'panel' };
  const ui = (items: PanelNotice[]) => (
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
  const store = new PanelStatusStore();
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
  const onInvestigateStatusItem = jest.fn();
  render(
    <PanelContextProvider
      value={{ notices: store, eventBus: new EventBusSrv(), eventsScope: 'panel', onInvestigateStatusItem }}
    >
      <section aria-label="First inspector">
        <PanelStatusActions statusItem={error} />
        <PanelStatusActions statusItem={warning} />
      </section>
      <section aria-label="Second inspector">
        <PanelStatusActions statusItem={error} />
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
  expect(onInvestigateStatusItem).toHaveBeenCalledWith(warning.id);
  await act(async () => {
    reject(new Error('Not allowed'));
  });
  expect(screen.getAllByRole('alert').map((element) => element.textContent)).toEqual([
    'Choose field: Not allowed',
    'Choose field: Not allowed',
  ]);
  expect(onClick).toHaveBeenCalledTimes(1);
});
