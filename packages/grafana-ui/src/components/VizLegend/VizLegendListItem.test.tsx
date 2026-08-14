import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VizLegendListItem, type Props } from './VizLegendListItem';
import { type VizLegendItem } from './types';

function makeItem(overrides: Partial<VizLegendItem> = {}): VizLegendItem {
  return { label: 'Series A', color: 'red', yAxis: 1, ...overrides };
}

function renderItem(overrides: Partial<Props<unknown>> = {}) {
  return render(<VizLegendListItem item={makeItem()} allItemsSelected={true} {...overrides} />);
}

describe('VizLegendListItem', () => {
  it('renders label and icon', () => {
    renderItem();
    expect(screen.getByText('Series A')).toBeInTheDocument();
    expect(screen.getByTestId('series-icon')).toBeInTheDocument();
  });

  it('shows "All series selected" aria-label when allItemsSelected is true', () => {
    renderItem({ allItemsSelected: true });
    expect(screen.getByRole('button', { name: /all series selected/i })).toBeInTheDocument();
  });

  it('shows "Only <label> selected" aria-label when allItemsSelected is false', () => {
    renderItem({ item: makeItem({ label: 'CPU' }), allItemsSelected: false });
    expect(screen.getByRole('button', { name: /only cpu selected/i })).toBeInTheDocument();
  });

  it('fires click, mouseover, and mouseout callbacks', async () => {
    const onLabelClick = jest.fn();
    const onLabelMouseOver = jest.fn();
    const onLabelMouseOut = jest.fn();
    renderItem({ onLabelClick, onLabelMouseOver, onLabelMouseOut });

    const button = screen.getByRole('button');
    await userEvent.hover(button);
    expect(onLabelMouseOver).toHaveBeenCalled();

    await userEvent.unhover(button);
    expect(onLabelMouseOut).toHaveBeenCalled();

    await userEvent.click(button);
    expect(onLabelClick).toHaveBeenCalledWith(expect.objectContaining({ label: 'Series A' }), expect.any(Object));
  });

  it('disables the button when readonly', () => {
    renderItem({ readonly: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders stats when getDisplayValues is provided', () => {
    renderItem({
      item: makeItem({
        getDisplayValues: () => [{ numeric: 10, text: '10', title: 'min' }],
      }),
    });
    expect(screen.getByText(/Min:/)).toBeInTheDocument();
  });
});
