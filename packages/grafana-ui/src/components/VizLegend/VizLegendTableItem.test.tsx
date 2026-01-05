import { render, screen } from '@testing-library/react';

import { LegendTableItem } from './VizLegendTableItem';
import { VizLegendItem } from './types';

describe('LegendTableItem', () => {
  const mockItem: VizLegendItem = {
    label: 'Series 1',
    color: 'red',
    yAxis: 1,
  };

  it('renders without crashing', () => {
    const { container } = render(
      <table>
        <tbody>
          <LegendTableItem item={mockItem} />
        </tbody>
      </table>
    );
    expect(container.querySelector('tr')).toBeInTheDocument();
  });

  it('renders label text', () => {
    render(
      <table>
        <tbody>
          <LegendTableItem item={mockItem} />
        </tbody>
      </table>
    );
    expect(screen.getByText('Series 1')).toBeInTheDocument();
  });

  it('renders with long label text', () => {
    const longLabelItem: VizLegendItem = {
      ...mockItem,
      label: 'This is a very long series name that should be scrollable in the table cell',
    };
    render(
      <table>
        <tbody>
          <LegendTableItem item={longLabelItem} />
        </tbody>
      </table>
    );
    expect(
      screen.getByText('This is a very long series name that should be scrollable in the table cell')
    ).toBeInTheDocument();
  });

  it('renders stat values when provided', () => {
    const itemWithStats: VizLegendItem = {
      ...mockItem,
      getDisplayValues: () => [
        { numeric: 100, text: '100', title: 'Max' },
        { numeric: 50, text: '50', title: 'Min' },
      ],
    };
    render(
      <table>
        <tbody>
          <LegendTableItem item={itemWithStats} />
        </tbody>
      </table>
    );
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders right y-axis indicator when yAxis is 2', () => {
    const rightAxisItem: VizLegendItem = {
      ...mockItem,
      yAxis: 2,
    };
    render(
      <table>
        <tbody>
          <LegendTableItem item={rightAxisItem} />
        </tbody>
      </table>
    );
    expect(screen.getByText('(right y-axis)')).toBeInTheDocument();
  });

  it('calls onLabelClick when label is clicked', () => {
    const onLabelClick = jest.fn();
    render(
      <table>
        <tbody>
          <LegendTableItem item={mockItem} onLabelClick={onLabelClick} />
        </tbody>
      </table>
    );
    const button = screen.getByRole('button');
    button.click();
    expect(onLabelClick).toHaveBeenCalledWith(mockItem, expect.any(Object));
  });

  it('does not call onClick when readonly', () => {
    const onLabelClick = jest.fn();
    render(
      <table>
        <tbody>
          <LegendTableItem item={mockItem} onLabelClick={onLabelClick} readonly={true} />
        </tbody>
      </table>
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
