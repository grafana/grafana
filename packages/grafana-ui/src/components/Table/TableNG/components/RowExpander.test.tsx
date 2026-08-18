import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { RowExpander } from './RowExpander';

describe('RowExpander', () => {
  const getExpander = () => screen.getByTestId(selectors.components.Panels.Visualization.TableNG.RowExpander);

  it('renders the collapsed state with the expand label and right-pointing angle', () => {
    render(<RowExpander onCellExpand={jest.fn()} rowId="row-1" isExpanded={false} />);
    const expander = getExpander();
    expect(expander).toHaveAttribute('aria-label', 'Expand row');
    expect(expander).toHaveAttribute('aria-expanded', 'false');
    expect(expander).toHaveAttribute('aria-controls', 'row-1');
  });

  it('renders the expanded state with the collapse label', () => {
    render(<RowExpander onCellExpand={jest.fn()} rowId="row-1" isExpanded={true} />);
    const expander = getExpander();
    expect(expander).toHaveAttribute('aria-label', 'Collapse row');
    expect(expander).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onCellExpand when clicked', async () => {
    const onCellExpand = jest.fn();
    render(<RowExpander onCellExpand={onCellExpand} rowId="row-1" />);
    await userEvent.click(getExpander());
    expect(onCellExpand).toHaveBeenCalledTimes(1);
  });

  it('calls onCellExpand when Enter is pressed', async () => {
    const onCellExpand = jest.fn();
    render(<RowExpander onCellExpand={onCellExpand} rowId="row-1" />);
    getExpander().focus();
    await userEvent.keyboard('{Enter}');
    expect(onCellExpand).toHaveBeenCalledTimes(1);
  });

  it('calls onCellExpand when Space is pressed', async () => {
    const onCellExpand = jest.fn();
    render(<RowExpander onCellExpand={onCellExpand} rowId="row-1" />);
    getExpander().focus();
    await userEvent.keyboard('[Space]');
    expect(onCellExpand).toHaveBeenCalledTimes(1);
  });

  it('does not call onCellExpand for other keys', async () => {
    const onCellExpand = jest.fn();
    render(<RowExpander onCellExpand={onCellExpand} rowId="row-1" />);
    getExpander().focus();
    await userEvent.keyboard('a');
    expect(onCellExpand).not.toHaveBeenCalled();
  });
});
