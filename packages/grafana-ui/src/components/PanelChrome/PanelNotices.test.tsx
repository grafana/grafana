import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PropsWithChildren, StrictMode } from 'react';

import { createTheme, EventBusSrv, ThemeContext, type PanelNotice } from '@grafana/data';
// Tests exercise host integration against Grafana's internal store without making it public package API.
// eslint-disable-next-line no-restricted-imports
import { PanelStatusStore } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';

import { PanelChrome } from './PanelChrome';
import { PanelContextProvider } from './PanelContext';
import { PanelStatus } from './PanelStatus';
import { PanelStatusActions } from './PanelStatusActions';
import { usePanelNotices, usePanelStatusSnapshot } from './usePanelNotices';

function Reporter({ items }: { items: readonly PanelNotice[] }) {
  usePanelNotices(items);
  return <div>Visualization</div>;
}

it('returns the host notice controller or undefined when unsupported', () => {
  const notices = new PanelStatusStore();
  const items: PanelNotice[] = [];
  const wrapper = ({ children }: PropsWithChildren) => (
    <PanelContextProvider value={{ notices, eventBus: new EventBusSrv(), eventsScope: 'panel' }}>
      {children}
    </PanelContextProvider>
  );
  const { result, unmount } = renderHook(() => usePanelNotices(items), { wrapper });
  expect(result.current).toBe(notices);
  unmount();

  const { result: unsupportedResult } = renderHook(() => usePanelNotices(items));
  expect(unsupportedResult.current).toBeUndefined();
});

it('groups action-free query notices in the popover but keeps a custom CTA notice separate', async () => {
  const store = new PanelStatusStore();
  const notice = { origin: 'notice' as const, severity: 'warning' as const, text: 'Partial result' };
  store.setExternal([
    { ...notice, id: 'A', refId: 'A' },
    { ...notice, id: 'B', refId: 'B' },
    { ...notice, id: 'C', refId: 'C', actions: [{ id: 'retry', label: 'Retry', onClick: jest.fn() }] },
  ]);
  render(
    <PanelContextProvider value={{ notices: store, eventBus: new EventBusSrv(), eventsScope: 'panel' }}>
      <PanelStatus />
    </PanelContextProvider>
  );
  await userEvent.click(screen.getByRole('button', { name: 'status' }));
  expect(await screen.findByText('Partial result (A, B)')).toBeVisible();
  expect(screen.getByText('Partial result')).toBeVisible();
});

it.each([false, true])(
  'settles inline notices and resolvers without stale callbacks (notices: %s)',
  async (hasNotice) => {
    const store = new PanelStatusStore();
    const context = { notices: store, eventBus: new EventBusSrv(), eventsScope: 'panel' };
    const clicked = jest.fn();
    let renders = 0;
    function InlineReporter({ value }: { value: number }) {
      if (++renders > 30) {
        throw new Error('Panel notices did not settle');
      }
      usePanelNotices(
        hasNotice
          ? [
              {
                id: 'field',
                severity: 'warning',
                text: 'Choose field',
                actions: [{ id: 'choose', label: 'Choose', onClick: () => clicked(value) }],
              },
            ]
          : [],
        () => ({ actions: [{ id: 'resolve', label: 'Resolve', onClick: () => clicked(value * 10) }] })
      );
      const snapshot = usePanelStatusSnapshot(store);
      return (
        <div>
          Visualization
          {snapshot.items.map((item) => (
            <PanelStatusActions key={item.id} statusItem={item} />
          ))}
        </div>
      );
    }
    const ui = (value: number) => (
      <StrictMode>
        <PanelContextProvider value={context}>
          <PanelChrome width={400} height={200} title="My panel">
            {() => <InlineReporter value={value} />}
          </PanelChrome>
        </PanelContextProvider>
      </StrictMode>
    );
    const { rerender, unmount } = render(ui(1));
    rerender(ui(2));
    expect(screen.getByText('Visualization')).toBeVisible();
    if (hasNotice) {
      await userEvent.click(screen.getByRole('button', { name: 'Choose' }));
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      expect(clicked.mock.calls).toEqual([[2], [20]]);
    } else {
      expect(store.getSnapshot().items).toEqual([]);
    }
    unmount();
    expect(store.getSnapshot().items).toEqual([]);
  }
);

it.each(['structured', 'legacy'] as const)(
  'preserves %s host errors before activation and after clearing',
  async (kind) => {
    const store = new PanelStatusStore();
    const context = { notices: store, eventBus: new EventBusSrv(), eventsScope: 'panel' };
    const props =
      kind === 'structured'
        ? { statusItems: [{ severity: 'error' as const, text: 'Query failed' }] }
        : { statusMessage: 'Query failed' };
    render(
      <PanelContextProvider value={context}>
        <PanelChrome width={400} height={200} title="My panel" {...props}>
          {() => <div>Visualization</div>}
        </PanelChrome>
      </PanelContextProvider>
    );
    expect(screen.getByTestId(selectors.components.Panels.Panel.status('error'))).toBeVisible();
    act(() => store.createSource().set([{ id: 'panel', severity: 'warning', text: 'Choose field' }]));
    await userEvent.click(screen.getByTestId(selectors.components.Panels.Panel.status('error')));
    expect(await screen.findByText('Query failed')).toBeVisible();
    expect(screen.getByText('Choose field')).toBeVisible();
    act(() => store.setExternal([]));
    expect(screen.getByTestId(selectors.components.Panels.Panel.status('warning'))).toBeVisible();
    expect(screen.queryByText('Query failed')).not.toBeInTheDocument();
    act(() => store.clear());
    expect(screen.getByTestId(selectors.components.Panels.Panel.status('error'))).toBeVisible();
    act(() => store.setExternal([]));
    expect(screen.getByText('Visualization')).toBeVisible();
    expect(screen.queryByTestId(selectors.components.Panels.Panel.status('error'))).not.toBeInTheDocument();
  }
);

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
      <PanelContextProvider value={{ notices, eventBus: new EventBusSrv(), eventsScope: 'panel' }}>
        <PanelStatusActions statusItem={notices.getSnapshot().items[0]} />
      </PanelContextProvider>
    </ThemeContext.Provider>
  );
  expect(screen.getByRole('button', { name: 'Choose field' })).toHaveStyle({
    border: `1px solid ${theme.colors.secondary.subtleBorder}`,
    height: '32px',
  });
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

it('shares callback progress and failures across inspector views', async () => {
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
      actions: [{ id: 'fix', label: 'Choose field', onClick }],
    },
    { id: 'b', severity: 'warning', text: 'Partial data' },
  ]);
  const [error, warning] = store.getSnapshot().items;
  render(
    <PanelContextProvider value={{ notices: store, eventBus: new EventBusSrv(), eventsScope: 'panel' }}>
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
  expect(screen.queryByRole('button', { name: /with Assistant$/ })).not.toBeInTheDocument();
  await act(async () => {
    reject(new Error('Not allowed'));
  });
  expect(screen.getAllByRole('alert').map((element) => element.textContent)).toEqual([
    'Choose field: Not allowed',
    'Choose field: Not allowed',
  ]);
  expect(onClick).toHaveBeenCalledTimes(1);
});
