import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Row, type UseExpandedRowProps } from 'react-table';

import { type LevelItem } from '../FlameGraph/dataTransform';

import { FunctionCellWithExpander } from './FunctionCellWithExpander';
import { type CallTreeNode } from './utils';

const levelItem: LevelItem = { start: 0, value: 100, itemIndexes: [0], children: [], level: 0 };

function makeRow(
  overrides: Partial<CallTreeNode> & { isExpanded?: boolean; canExpand?: boolean }
): Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode> {
  const node: CallTreeNode = {
    id: overrides.id ?? 'node-1',
    label: overrides.label ?? 'someFunction',
    self: 10,
    total: 100,
    selfPercent: 10,
    totalPercent: 100,
    depth: overrides.depth ?? 1,
    parentId: overrides.parentId,
    children: overrides.children ?? [],
    subtreeSize: overrides.subtreeSize ?? 0,
    levelItem,
    ...overrides,
  };
  return {
    original: node,
    isExpanded: overrides.isExpanded ?? false,
    canExpand: overrides.canExpand ?? true,
    toggleRowExpanded: jest.fn(),
  } as unknown as Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>;
}

function renderCell(
  row: Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>,
  props: Partial<React.ComponentProps<typeof FunctionCellWithExpander>> = {}
) {
  return render(
    <FunctionCellWithExpander
      row={row}
      value={row.original.label}
      depth={row.original.depth}
      hasChildren={props.hasChildren ?? (row.original.children?.length ?? 0) > 0}
      rows={[]}
      onSymbolClick={jest.fn()}
      toggleRowExpanded={jest.fn()}
      {...props}
    />
  );
}

describe('FunctionCellWithExpander', () => {
  it('renders the expander inside the function-name button for rows with children', () => {
    const row = makeRow({ children: [{ id: 'c1', label: 'child1' } as CallTreeNode] });
    renderCell(row);

    const expander = screen.getByTestId('call-tree-row-expander');
    expect(expander).toBeInTheDocument();
    // The expander is a child of the function-name button so a single Tab
    // stop expands and a single click also opens the symbol detail.
    const button = expander.closest('button');
    expect(button).toBe(screen.getByRole('button', { name: /someFunction/ }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('hides the expander when the row has no children', () => {
    const row = makeRow({ children: [] });
    renderCell(row, { hasChildren: false });

    expect(screen.queryByTestId('call-tree-row-expander')).toBeNull();
  });

  it('shows angle-right when the row is collapsed and angle-down when expanded', () => {
    const collapsed = makeRow({ isExpanded: false, children: [{ id: 'c1' } as CallTreeNode] });
    const { rerender } = renderCell(collapsed);
    // The Icon component renders the SVG directly with the data-testid we
    // pass through, so the icon name is visible only in the svg's id
    // (e.g. "public/build/img/icons/unicons/angle-right.svg"). Query on the
    // svg id path to assert which icon is actually in the DOM.
    expect(document.querySelector('svg[id*="angle-right"]')).toBeInTheDocument();
    expect(document.querySelector('svg[id*="angle-down"]')).toBeNull();

    const expanded = makeRow({ isExpanded: true, children: [{ id: 'c1' } as CallTreeNode] });
    rerender(
      <FunctionCellWithExpander
        row={expanded}
        value={expanded.original.label}
        depth={expanded.original.depth}
        hasChildren
        rows={[]}
        onSymbolClick={jest.fn()}
        toggleRowExpanded={jest.fn()}
      />
    );
    expect(document.querySelector('svg[id*="angle-down"]')).toBeInTheDocument();
    expect(document.querySelector('svg[id*="angle-right"]')).toBeNull();
  });

  it('marks aria-expanded=true (not the attribute being absent) on expanded rows', () => {
    const row = makeRow({ isExpanded: true, children: [{ id: 'c1' } as CallTreeNode] });
    renderCell(row);

    const button = screen.getByRole('button', { name: /someFunction/ });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles row expansion when the function-name button is clicked', async () => {
    const user = userEvent.setup();
    const toggleRowExpanded = jest.fn();
    const row = {
      ...makeRow({ children: [{ id: 'c1' } as CallTreeNode] }),
      toggleRowExpanded,
    } as unknown as Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>;

    renderCell(row);

    await user.click(screen.getByRole('button', { name: /someFunction/ }));
    expect(toggleRowExpanded).toHaveBeenCalledTimes(1);
  });

  it('does not double-toggle when the expander icon itself is clicked (same button as function name)', async () => {
    const user = userEvent.setup();
    const toggleRowExpanded = jest.fn();
    const onSymbolClick = jest.fn();
    const row = {
      ...makeRow({ children: [{ id: 'c1' } as CallTreeNode] }),
      toggleRowExpanded,
    } as unknown as Row<CallTreeNode> & UseExpandedRowProps<CallTreeNode>;

    render(
      <FunctionCellWithExpander
        row={row}
        value={row.original.label}
        depth={row.original.depth}
        hasChildren
        rows={[]}
        onSymbolClick={onSymbolClick}
        toggleRowExpanded={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('call-tree-row-expander'));
    // Single click on the expander icon (a child of the function-name button)
    // bubbles up to the button, so toggleRowExpanded is called exactly once,
    // not twice. The icon no longer has its own onClick handler.
    expect(toggleRowExpanded).toHaveBeenCalledTimes(1);
  });

  it('keeps the expander visible in compact mode', () => {
    const row = makeRow({ children: [{ id: 'c1' } as CallTreeNode] });
    renderCell(row, { compact: true });

    expect(screen.getByTestId('call-tree-row-expander')).toBeInTheDocument();
  });
});
