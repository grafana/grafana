import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';

import { TilingLayout } from './TilingLayout';
import { TilingTab } from './TilingTab';
import { useTilingView } from './context';
import { createTilingDocument, tilingLayout as L } from './model/spec';
import { type LayoutDocument, type PanelNode, type SplitNode } from './model/types';

let mounts: Record<string, number> = {};

function Content() {
  const view = useTilingView();
  const counted = useRef(false);
  if (!counted.current) {
    counted.current = true;
    mounts[view.id] = (mounts[view.id] ?? 0) + 1;
  }
  return <div>content of {view.title}</div>;
}

function createDoc() {
  return createTilingDocument(
    L.row(
      [
        L.panel({ id: 'left' }, L.view('a', { title: 'Alpha' }), L.view('b', { title: 'Beta' })),
        L.panel({ id: 'right' }, L.view('c', { title: 'Gamma' })),
      ],
      undefined,
      'root'
    )
  );
}

function Controlled({
  onChange,
  ...rest
}: { onChange?: (doc: LayoutDocument) => void } & Partial<Parameters<typeof TilingLayout>[0]>) {
  const [doc, setDoc] = useState(createDoc);
  return (
    <TilingLayout
      layout={doc}
      onLayoutChange={(next) => {
        setDoc(next);
        onChange?.(next);
      }}
      renderView={() => <Content />}
      {...rest}
    />
  );
}

function tabList(panelId: string) {
  // eslint-disable-next-line testing-library/no-node-access
  return document.querySelector<HTMLElement>(`[data-tiling-tabs="${panelId}"]`)!;
}

describe('TilingLayout', () => {
  beforeEach(() => {
    mounts = {};
  });

  it('renders every view once, with tabs grouped by panel', () => {
    render(<Controlled />);
    expect(
      within(tabList('left'))
        .getAllByRole('tab')
        .map((t) => t.textContent)
    ).toEqual(['Alpha', 'Beta']);
    expect(
      within(tabList('right'))
        .getAllByRole('tab')
        .map((t) => t.textContent)
    ).toEqual(['Gamma']);
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('content of Beta')).toBeInTheDocument();
    expect(mounts).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('selects tabs with the keyboard', async () => {
    render(<Controlled />);
    const alpha = screen.getByRole('tab', { name: /Alpha/ });
    alpha.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Beta/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('closes a view from its tab and gives its space to the neighbour', async () => {
    const onChange = jest.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close Gamma' }));
    expect(screen.queryByRole('tab', { name: /Gamma/ })).not.toBeInTheDocument();
    const doc: LayoutDocument = onChange.mock.calls.at(-1)[0];
    expect((doc.root as PanelNode).id).toBe('left');
    expect(doc.views.c).toBeUndefined();
  });

  it('keeps a view open when the close guard says no', async () => {
    const guard = jest.fn().mockResolvedValue(false);
    render(<Controlled onBeforeViewClose={guard} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close Gamma' }));
    await waitFor(() => expect(guard).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' })));
    expect(screen.getByRole('tab', { name: /Gamma/ })).toBeInTheDocument();
  });

  it('moves a tab into another panel from the menu without remounting its content', async () => {
    const onChange = jest.fn();
    render(<Controlled onChange={onChange} />);
    const menuButtons = screen.getAllByRole('button', { name: 'Panel menu' });
    await userEvent.click(menuButtons[1]);
    await userEvent.hover(await screen.findByRole('menuitem', { name: /Move Gamma to/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Alpha, Beta' }));

    expect(
      within(tabList('left'))
        .getAllByRole('tab')
        .map((t) => t.textContent)
    ).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(mounts).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('splits a tab out into a new panel from the menu', async () => {
    const onChange = jest.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Panel menu' })[0]);
    await userEvent.hover(await screen.findByRole('menuitem', { name: /Move Alpha to/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'New split below' }));

    const root = onChange.mock.calls.at(-1)[0].root as SplitNode;
    const column = root.children[0] as SplitNode;
    expect(column.axis).toBe('y');
    expect(column.children.map((c) => (c as PanelNode).views)).toEqual([['b'], ['a']]);
    expect(mounts).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('hides a panel and keeps its content mounted', async () => {
    const onChange = jest.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Panel menu' })[1]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Hide' }));
    expect(screen.queryByRole('tab', { name: /Gamma/ })).not.toBeInTheDocument();
    expect(onChange.mock.calls.at(-1)[0].hidden).toHaveLength(1);
    expect(screen.getByText('content of Gamma')).toBeInTheDocument();
  });

  it('maximizes a panel by double-clicking its tab bar', async () => {
    const onMaximizeChange = jest.fn();
    render(<Controlled onMaximizeChange={onMaximizeChange} />);
    // eslint-disable-next-line testing-library/no-node-access
    await userEvent.dblClick(document.querySelector('[data-tiling-tabbar="right"]')!);
    expect(onMaximizeChange).toHaveBeenCalledWith('right');
    // Esc steps out while focus is in the layout's chrome.
    screen.getByRole('tab', { name: /Gamma/ }).focus();
    await userEvent.keyboard('{Escape}');
    expect(onMaximizeChange).toHaveBeenLastCalledWith(null);
  });

  it('renders custom tab content and tab bar actions', async () => {
    const onAction = jest.fn();
    render(
      <Controlled
        renderTab={(props) => <TilingTab {...props} suffix={<span>badge-{props.view.id}</span>} />}
        renderTabBarActions={(panel) => (
          <button onClick={() => onAction(panel.selectedView.id)}>Refresh {panel.selectedView.title}</button>
        )}
      />
    );
    expect(screen.getByText('badge-c')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh Gamma' }));
    expect(onAction).toHaveBeenCalledWith('c');
  });

  it('lets consumers edit the panel menu', async () => {
    const onInspect = jest.fn();
    render(
      <Controlled
        getPanelMenu={(entries, panel) => [
          { id: 'inspect', label: 'Inspect', onClick: () => onInspect(panel.selectedView.id) },
          ...entries.filter((e) => e === 'divider' || e.id !== 'hide'),
        ]}
      />
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Panel menu' })[1]);
    expect(screen.queryByRole('menuitem', { name: 'Hide' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Inspect' }));
    expect(onInspect).toHaveBeenCalledWith('c');
  });
});
