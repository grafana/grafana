import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LegendTableItem, type Props } from './VizLegendTableItem';
import { type VizLegendItem } from './types';

function makeItem(overrides: Partial<VizLegendItem> = {}): VizLegendItem {
  return { label: 'Series A', color: 'red', yAxis: 1, ...overrides };
}

function renderInTable(overrides: Partial<Props> = {}) {
  return render(
    <table>
      <tbody>
        <LegendTableItem item={makeItem()} {...overrides} />
      </tbody>
    </table>
  );
}

describe('LegendTableItem', () => {
  it('renders label, icon, and button title', () => {
    renderInTable({ item: makeItem({ label: 'CPU usage' }) });
    expect(screen.getByText('CPU usage')).toBeInTheDocument();
    expect(screen.getByTestId('series-icon')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('title', 'CPU usage');
  });

  it('shows "(right y-axis)" indicator for yAxis 2', () => {
    renderInTable({ item: makeItem({ yAxis: 2 }) });
    expect(screen.getByText('(right y-axis)')).toBeInTheDocument();
  });

  it('renders stat values from getDisplayValues', () => {
    renderInTable({
      item: makeItem({
        getDisplayValues: () => [{ numeric: 10, text: '10', title: 'min' }],
      }),
    });
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('fires click, mouseover, and mouseout callbacks', async () => {
    const onLabelClick = jest.fn();
    const onLabelMouseOver = jest.fn();
    const onLabelMouseOut = jest.fn();
    renderInTable({ onLabelClick, onLabelMouseOver, onLabelMouseOut });

    const button = screen.getByRole('button');
    await userEvent.hover(button);
    expect(onLabelMouseOver).toHaveBeenCalled();

    await userEvent.unhover(button);
    expect(onLabelMouseOut).toHaveBeenCalled();

    await userEvent.click(button);
    expect(onLabelClick).toHaveBeenCalledWith(expect.objectContaining({ label: 'Series A' }), expect.any(Object));
  });

  it('disables button and suppresses onClick when readonly', async () => {
    const onLabelClick = jest.fn();
    renderInTable({ onLabelClick, readonly: true });
    expect(screen.getByRole('button')).toBeDisabled();
    await userEvent.click(screen.getByRole('button'));
    expect(onLabelClick).not.toHaveBeenCalled();
  });
});
