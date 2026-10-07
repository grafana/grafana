import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { ColumnVisibilitySidePanel } from './ColumnVisibilitySidePanel';

const columns = [
  { name: 'Column A', hideable: true },
  { name: 'Column B', hideable: true },
];

function Harness({ initialHidden = new Set<string>() }: { initialHidden?: Set<string> }) {
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(initialHidden);

  return (
    <ColumnVisibilitySidePanel
      columns={columns}
      hiddenColumns={hiddenColumns}
      onToggleColumn={(displayName, visible) => {
        setHiddenColumns((current) => {
          const next = new Set(current);
          if (visible) {
            next.delete(displayName);
          } else {
            next.add(displayName);
          }
          return next;
        });
      }}
      onClose={jest.fn()}
    />
  );
}

describe('ColumnVisibilitySidePanel', () => {
  it('places checkboxes at the row padding without reserving space for drag handles', () => {
    render(<Harness />);

    const row = screen.getByTestId(selectors.components.Panels.Visualization.TableNG.columnsSidebar.row('Column A'));
    expect(row.firstElementChild).toContainElement(screen.getByLabelText('Hide Column A'));
    expect(row).toHaveStyle({ paddingLeft: '12px' });
  });

  it('ignores hidden names absent from the current catalog when protecting the last visible column', async () => {
    render(<Harness initialHidden={new Set(['Missing'])} />);

    await userEvent.click(screen.getByLabelText('Hide Column A'));

    expect(screen.getByLabelText('Show Column A')).not.toBeChecked();
    expect(screen.getByLabelText('Hide Column B')).toBeDisabled();
  });

  it('prevents hiding the last visible column', async () => {
    render(<Harness initialHidden={new Set(['Column B'])} />);

    const checkboxB = screen.getByLabelText('Show Column B');
    expect(checkboxB).not.toBeChecked();
    const checkboxA = screen.getByLabelText('Hide Column A');
    expect(checkboxA).toBeDisabled();
  });

  it('hides a visible column', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByLabelText('Hide Column A'));
    expect(await screen.findByLabelText('Show Column A')).toBeInTheDocument();
  });

  it('dims before closing at the splitter threshold', () => {
    const props = {
      columns,
      hiddenColumns: new Set<string>(),
      onToggleColumn: jest.fn(),
      onClose: jest.fn(),
    };

    const { rerender } = render(<ColumnVisibilitySidePanel {...props} />);
    const panel = screen.getByRole('group', { name: 'Column visibility' });
    const contents = panel.firstElementChild!;
    expect(window.getComputedStyle(contents).opacity).toBe('');

    rerender(<ColumnVisibilitySidePanel {...props} willCloseOnRelease />);
    expect(window.getComputedStyle(contents).opacity).toBe('0.5');
  });

  it('closes from the close button', async () => {
    const onClose = jest.fn();
    render(
      <ColumnVisibilitySidePanel
        columns={columns}
        hiddenColumns={new Set()}
        onToggleColumn={jest.fn()}
        onClose={onClose}
      />
    );

    await userEvent.click(screen.getByLabelText('Close column visibility panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
