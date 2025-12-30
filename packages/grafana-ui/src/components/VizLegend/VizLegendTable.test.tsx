import { render, screen } from '@testing-library/react';

import { VizLegendTable } from './VizLegendTable';
import { VizLegendItem } from './types';

describe('VizLegendTable', () => {
  const mockItems: VizLegendItem[] = [
    { label: 'Series 1', color: 'red', yAxis: 1 },
    { label: 'Series 2', color: 'blue', yAxis: 1 },
    { label: 'Series 3', color: 'green', yAxis: 1 },
  ];

  it('renders without crashing', () => {
    const { container } = render(<VizLegendTable items={mockItems} placement="bottom" />);
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('renders all items', () => {
    render(<VizLegendTable items={mockItems} placement="bottom" />);
    expect(screen.getByText('Series 1')).toBeInTheDocument();
    expect(screen.getByText('Series 2')).toBeInTheDocument();
    expect(screen.getByText('Series 3')).toBeInTheDocument();
  });

  it('renders table headers when items have display values', () => {
    const itemsWithStats: VizLegendItem[] = [
      {
        label: 'Series 1',
        color: 'red',
        yAxis: 1,
        getDisplayValues: () => [
          { numeric: 100, text: '100', title: 'Max' },
          { numeric: 50, text: '50', title: 'Min' },
        ],
      },
    ];
    render(<VizLegendTable items={itemsWithStats} placement="bottom" />);
    expect(screen.getByText('Max')).toBeInTheDocument();
    expect(screen.getByText('Min')).toBeInTheDocument();
  });

  it('renders sort icon when sorted', () => {
    const { container } = render(
      <VizLegendTable items={mockItems} placement="bottom" sortBy="Name" sortDesc={false} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('calls onToggleSort when header is clicked', () => {
    const onToggleSort = jest.fn();
    render(<VizLegendTable items={mockItems} placement="bottom" onToggleSort={onToggleSort} isSortable={true} />);
    const header = screen.getByText('Name');
    header.click();
    expect(onToggleSort).toHaveBeenCalledWith('Name');
  });

  it('does not call onToggleSort when not sortable', () => {
    const onToggleSort = jest.fn();
    render(<VizLegendTable items={mockItems} placement="bottom" onToggleSort={onToggleSort} isSortable={false} />);
    const header = screen.getByText('Name');
    header.click();
    expect(onToggleSort).not.toHaveBeenCalled();
  });

  it('renders with long labels', () => {
    const itemsWithLongLabels: VizLegendItem[] = [
      {
        label: 'This is a very long series name that should be scrollable within its table cell',
        color: 'red',
        yAxis: 1,
      },
    ];
    render(<VizLegendTable items={itemsWithLongLabels} placement="bottom" />);
    expect(
      screen.getByText('This is a very long series name that should be scrollable within its table cell')
    ).toBeInTheDocument();
  });
});
