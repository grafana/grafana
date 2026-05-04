import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VizLegendTable } from './VizLegendTable';
import { type VizLegendItem } from './types';

function makeItem(label: string, stats?: Array<{ title: string; numeric: number }>): VizLegendItem {
  return {
    label,
    color: 'red',
    yAxis: 1,
    ...(stats && {
      getDisplayValues: () => stats.map((s) => ({ numeric: s.numeric, text: String(s.numeric), title: s.title })),
    }),
  };
}

describe('VizLegendTable', () => {
  it('renders deduplicated column headers from items getDisplayValues', () => {
    const items = [
      makeItem('A', [
        { title: 'min', numeric: 1 },
        { title: 'max', numeric: 10 },
      ]),
      makeItem('B', [{ title: 'min', numeric: 5 }]),
    ];
    render(<VizLegendTable placement="bottom" items={items} isSortable />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getAllByText('min')).toHaveLength(1);
    expect(screen.getByText('max')).toBeInTheDocument();
  });

  it('calls onToggleSort only when isSortable is true', async () => {
    const onToggleSort = jest.fn();
    const items = [makeItem('A', [{ title: 'min', numeric: 1 }])];

    const { unmount } = render(
      <VizLegendTable placement="bottom" items={items} onToggleSort={onToggleSort} isSortable />
    );
    await userEvent.click(screen.getByText('min'));
    expect(onToggleSort).toHaveBeenCalledWith('min');
    unmount();

    onToggleSort.mockClear();
    render(<VizLegendTable placement="bottom" items={items} onToggleSort={onToggleSort} isSortable={false} />);
    await userEvent.click(screen.getByText('min'));
    expect(onToggleSort).not.toHaveBeenCalled();
  });

  it.each([
    { sortBy: 'Name', sortDesc: false, expected: ['Apple', 'Banana', 'Cherry'] },
    { sortBy: 'Name', sortDesc: true, expected: ['Cherry', 'Banana', 'Apple'] },
  ])('sorts by name ($sortDesc ? desc : asc)', ({ sortBy, sortDesc, expected }) => {
    const items = [makeItem('Banana'), makeItem('Apple'), makeItem('Cherry')];
    render(<VizLegendTable placement="bottom" items={items} sortBy={sortBy} sortDesc={sortDesc} isSortable />);
    const labels = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    expect(labels).toEqual(expected);
  });

  it('sorts by stat value ascending', () => {
    const items = [
      makeItem('C', [{ title: 'avg', numeric: 30 }]),
      makeItem('A', [{ title: 'avg', numeric: 10 }]),
      makeItem('B', [{ title: 'avg', numeric: 20 }]),
    ];
    render(<VizLegendTable placement="bottom" items={items} sortBy="avg" sortDesc={false} isSortable />);
    expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual(['A', 'B', 'C']);
  });

  it('shows correct sort direction icon', () => {
    const items = [makeItem('A', [{ title: 'min', numeric: 1 }])];
    const { rerender } = render(
      <VizLegendTable placement="bottom" items={items} sortBy="min" sortDesc={false} isSortable />
    );
    const th = () => screen.getByText('min').closest('th')!;
    expect(th().querySelector('[data-testid$="angle-up"]')).toBeTruthy();

    rerender(<VizLegendTable placement="bottom" items={items} sortBy="min" sortDesc={true} isSortable />);
    expect(th().querySelector('[data-testid$="angle-down"]')).toBeTruthy();
  });

  it('limits displayed items and reveals all on click', async () => {
    const items = [makeItem('A'), makeItem('B'), makeItem('C')];
    render(<VizLegendTable placement="bottom" items={items} limit={2} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.queryByText('C')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(/show all/));
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.queryByText(/show all/)).not.toBeInTheDocument();
  });

  it('renders filterAction in the Name column header', () => {
    render(
      <VizLegendTable
        placement="bottom"
        items={[makeItem('A')]}
        filterAction={<span data-testid="filter">Filter</span>}
        isSortable
      />
    );
    expect(within(screen.getByText('Name').closest('th')!).getByTestId('filter')).toBeInTheDocument();
  });

  it('applies sr-only to headers when not sortable', () => {
    render(
      <VizLegendTable placement="bottom" items={[makeItem('A', [{ title: 'min', numeric: 1 }])]} isSortable={false} />
    );
    screen.getAllByRole('columnheader').forEach((th) => {
      expect(th.className).toContain('sr-only');
    });
  });

  it('uses custom itemRenderer when provided', () => {
    const itemRenderer = jest.fn((item: VizLegendItem) => (
      <tr key={item.label}>
        <td>{item.label}-custom</td>
      </tr>
    ));
    render(<VizLegendTable placement="bottom" items={[makeItem('X')]} itemRenderer={itemRenderer} />);
    expect(screen.getByText('X-custom')).toBeInTheDocument();
  });
});

  it('shows (right y-axis) when items have mixed axes', () => {
    const items = [
      makeItem('Left'),
      makeItem('Right', [{ title: 'min', numeric: 1 }]),
    ];
    items[1].yAxis = 2;
    render(<VizLegendTable placement="bottom" items={items} />);
    expect(screen.getByText('(right y-axis)')).toBeInTheDocument();
  });

  it('does not show (right y-axis) when all items use the right axis', () => {
    const items = [
      makeItem('A', [{ title: 'min', numeric: 1 }]),
      makeItem('B', [{ title: 'min', numeric: 2 }]),
    ];
    items[0].yAxis = 2;
    items[1].yAxis = 2;
    render(<VizLegendTable placement="bottom" items={items} />);
    expect(screen.queryByText('(right y-axis)')).not.toBeInTheDocument();
  });
