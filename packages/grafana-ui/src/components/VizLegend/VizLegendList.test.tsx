import { render, screen } from '@testing-library/react';

import { VizLegendList } from './VizLegendList';
import { type VizLegendItem } from './types';

function makeItem(label: string, yAxis = 1): VizLegendItem {
  return { label, color: 'red', yAxis };
}

const filterAction = <span data-testid="filter">Filter</span>;

describe('VizLegendList', () => {
  it('renders all items for bottom placement, splitting by yAxis', () => {
    render(<VizLegendList placement="bottom" items={[makeItem('Left', 1), makeItem('Right', 2)]} />);
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('renders filterAction in left section (or right section if no left items)', () => {
    const { unmount } = render(
      <VizLegendList placement="bottom" items={[makeItem('A', 1)]} filterAction={filterAction} />
    );
    expect(screen.getByTestId('filter')).toBeInTheDocument();
    unmount();

    render(<VizLegendList placement="bottom" items={[makeItem('R', 2)]} filterAction={filterAction} />);
    expect(screen.getByTestId('filter')).toBeInTheDocument();
  });

  it('renders all items in a single column for right placement with filterAction', () => {
    render(
      <VizLegendList placement="right" items={[makeItem('A', 1), makeItem('B', 2)]} filterAction={filterAction} />
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByTestId('filter')).toBeInTheDocument();
  });

  it('uses custom itemRenderer when provided', () => {
    const itemRenderer = jest.fn((item: VizLegendItem) => <span>{item.label}-custom</span>);
    render(<VizLegendList placement="bottom" items={[makeItem('A')]} itemRenderer={itemRenderer} />);
    expect(screen.getByText('A-custom')).toBeInTheDocument();
    expect(itemRenderer).toHaveBeenCalled();
  });
});
