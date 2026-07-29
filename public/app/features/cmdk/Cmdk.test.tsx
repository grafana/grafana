import { act, render, screen } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { Cmdk } from './Cmdk';
import { registerCmdkSource } from './registry';
import { type CmdkActionCallback, type CmdkItem, type CmdkItemAction, type CmdkSource } from './types';
import { closeCmdk, openCmdk } from './visibility';

const SECTION = { id: 'test-section', title: 'Test section' };

function actionItem(id: string, overrides: Partial<Omit<CmdkItemAction, 'type'>> = {}): CmdkItemAction {
  return {
    type: 'action',
    id,
    sectionId: SECTION.id,
    title: id,
    priority: 0,
    action: jest.fn(),
    ...overrides,
  };
}

function makeSource(query: CmdkSource['query'], overrides: Partial<CmdkSource> = {}): CmdkSource {
  return {
    query,
    providedSections: [SECTION],
    ...overrides,
  };
}

describe('Cmdk', () => {
  let unregisterFns: Array<() => void> = [];

  beforeAll(() => {
    // Not implemented in jsdom
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  function registerSource(source: CmdkSource) {
    unregisterFns.push(registerCmdkSource(source));
    return source;
  }

  function setup() {
    const result = render(<Cmdk />);
    act(() => openCmdk());
    return result;
  }

  afterEach(() => {
    act(() => closeCmdk());
    unregisterFns.forEach((unregister) => unregister());
    unregisterFns = [];
  });

  it('opens with mod+k and closes on escape', async () => {
    const { user } = render(<Cmdk />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('queries sources with the empty query on open and renders items in their section', async () => {
    const query = jest.fn().mockResolvedValue([actionItem('Item A')]);
    registerSource(makeSource(query));

    setup();

    expect(await screen.findByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Test section')).toBeInTheDocument();
    expect(query).toHaveBeenCalledWith('', expect.any(AbortSignal));
  });

  it('requeries sources when typing and keeps old results until new ones arrive', async () => {
    const query = jest.fn().mockImplementation(async (searchQuery: string) => {
      if (searchQuery === '') {
        return [actionItem('Item A')];
      }
      // Never resolves, simulating a slow query
      return new Promise<CmdkItem[]>(() => {});
    });
    registerSource(makeSource(query));

    const { user } = setup();
    expect(await screen.findByText('Item A')).toBeInTheDocument();

    await user.type(screen.getByRole('combobox'), 'foo');

    expect(query).toHaveBeenLastCalledWith('foo', expect.any(AbortSignal));
    expect(screen.getByText('Item A')).toBeInTheDocument();
  });

  it('hides a section with no items and shows the empty state', async () => {
    const query = jest.fn().mockResolvedValue([]);
    registerSource(makeSource(query));

    setup();

    expect(await screen.findByText('No results found')).toBeInTheDocument();
    expect(screen.queryByText('Test section')).not.toBeInTheDocument();
  });

  it('runs an action item on enter and closes', async () => {
    const item = actionItem('Item A');
    registerSource(makeSource(jest.fn().mockResolvedValue([item])));

    const { user } = setup();
    await screen.findByText('Item A');

    await user.keyboard('{Enter}');

    expect(item.action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('navigates on selecting a navigation item', async () => {
    const item: CmdkItem = {
      type: 'navigation',
      id: 'nav-item',
      sectionId: SECTION.id,
      title: 'Go somewhere',
      priority: 0,
      href: '/somewhere',
    };
    registerSource(makeSource(jest.fn().mockResolvedValue([item])));

    const { user } = setup();
    await screen.findByText('Go somewhere');

    await user.keyboard('{Enter}');

    expect(locationService.getLocation().pathname).toBe('/somewhere');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('runs an additional action when its shortcut is pressed on the focused item', async () => {
    const action = jest.fn();
    const additionalAction: CmdkActionCallback = {
      type: 'action',
      title: 'Open in new tab',
      shortcut: 'shift+enter',
      action,
    };
    const item = actionItem('Item A', { additionalActions: [additionalAction] });
    registerSource(makeSource(jest.fn().mockResolvedValue([item])));

    const { user } = setup();
    await screen.findByText('Item A');

    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(action).toHaveBeenCalledTimes(1);
    expect(item.action).not.toHaveBeenCalled();
  });

  it('pushes a subscope from an additional action, via shortcut and pill click', async () => {
    const subscopeSource = makeSource(
      jest.fn().mockResolvedValue([actionItem('Child item', { sectionId: 'sub-section' })]),
      { providedSections: [{ id: 'sub-section', title: 'Sub section' }], subscopeName: 'Children' }
    );
    const item = actionItem('Item A', {
      additionalActions: [
        { type: 'subscope', title: 'Browse', shortcut: 'shift+enter', getScope: () => subscopeSource },
      ],
    });
    registerSource(makeSource(jest.fn().mockResolvedValue([item])));

    const { user } = setup();
    await screen.findByText('Item A');

    await user.keyboard('{Shift>}{Enter}{/Shift}');

    // Item itself was not selected, the palette dove into the subscope instead
    expect(item.action).not.toHaveBeenCalled();
    expect(await screen.findByText('Children')).toBeInTheDocument();
    expect(await screen.findByText('Child item')).toBeInTheDocument();

    // Backspace pops back out, then the pill click dives in again
    await user.keyboard('{Backspace}');
    await user.click(await screen.findByRole('button', { name: /Browse/ }));

    expect(await screen.findByText('Child item')).toBeInTheDocument();
    expect(item.action).not.toHaveBeenCalled();
  });

  it('pushes a subscope on select and pops it with backspace on empty input', async () => {
    const subscopeSource = makeSource(
      jest.fn().mockResolvedValue([actionItem('Subscope item', { sectionId: 'sub-section' })]),
      { providedSections: [{ id: 'sub-section', title: 'Sub section' }], subscopeName: 'Dashboards' }
    );
    const item: CmdkItem = {
      type: 'subscope',
      id: 'subscope-item',
      sectionId: SECTION.id,
      title: 'Dive into dashboards',
      priority: 0,
      getScope: () => subscopeSource,
    };
    registerSource(makeSource(jest.fn().mockResolvedValue([item])));

    const { user } = setup();
    await screen.findByText('Dive into dashboards');

    await user.keyboard('{Enter}');

    // Subscope pill is shown and only the subscope source is queried
    expect(await screen.findByText('Dashboards')).toBeInTheDocument();
    expect(await screen.findByText('Subscope item')).toBeInTheDocument();
    expect(screen.queryByText('Dive into dashboards')).not.toBeInTheDocument();

    await user.keyboard('{Backspace}');

    expect(await screen.findByText('Dive into dashboards')).toBeInTheDocument();
    expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
  });

  it('sends the abort signal to sources when the query changes', async () => {
    const signals: AbortSignal[] = [];
    const query = jest.fn().mockImplementation(async (searchQuery: string, signal: AbortSignal) => {
      signals.push(signal);
      return [];
    });
    registerSource(makeSource(query));

    const { user } = setup();
    await screen.findByText('No results found');

    await user.type(screen.getByRole('combobox'), 'a');

    expect(signals[0].aborted).toBe(true);
    expect(signals[signals.length - 1].aborted).toBe(false);
  });
});
