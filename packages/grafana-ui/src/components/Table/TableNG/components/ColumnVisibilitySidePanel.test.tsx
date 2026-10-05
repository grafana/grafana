import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { ColumnVisibilitySidePanel } from './ColumnVisibilitySidePanel';

function createDataTransfer() {
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: jest.fn(),
    getData: jest.fn(),
    setDragImage: jest.fn(),
  };
}

const columns = [
  { name: 'Column A', reorderable: true, hideable: true },
  { name: 'Column B', reorderable: true, hideable: true },
];

function Harness({
  initialHidden = new Set<string>(),
  onColumnsReorder = jest.fn(),
}: {
  initialHidden?: Set<string>;
  onColumnsReorder?: (source: string, target: string) => void;
}) {
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
      onColumnsReorder={onColumnsReorder}
      onClose={jest.fn()}
    />
  );
}

describe('ColumnVisibilitySidePanel', () => {
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

  it('reports a drag reorder', () => {
    const onColumnsReorder = jest.fn();
    render(<Harness onColumnsReorder={onColumnsReorder} />);

    const handleB = screen.getByLabelText('Reorder Column B');
    const rowA = screen.getByLabelText('Reorder Column A').closest('div')!;
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(handleB, { dataTransfer });
    fireEvent.dragOver(rowA, { dataTransfer });
    fireEvent.drop(rowA, { dataTransfer });

    expect(onColumnsReorder).toHaveBeenCalledWith('Column B', 'Column A');
  });

  it('moves a column with the keyboard and ignores moves beyond the first column', async () => {
    const user = userEvent.setup();
    const onColumnsReorder = jest.fn();
    render(<Harness onColumnsReorder={onColumnsReorder} />);
    await user.click(screen.getByRole('button', { name: 'Reorder Column B' }));
    await user.keyboard('{ArrowUp}');
    expect(onColumnsReorder).toHaveBeenCalledWith('Column B', 'Column A');
    onColumnsReorder.mockClear();
    await user.click(screen.getByRole('button', { name: 'Reorder Column A' }));
    await user.keyboard('{ArrowUp}');
    expect(onColumnsReorder).not.toHaveBeenCalled();
  });

  it('dims before closing at the splitter threshold', () => {
    const props = {
      columns,
      hiddenColumns: new Set<string>(),
      onToggleColumn: jest.fn(),
      onColumnsReorder: jest.fn(),
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
        onColumnsReorder={jest.fn()}
        onClose={onClose}
      />
    );

    await userEvent.click(screen.getByLabelText('Close column visibility panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
