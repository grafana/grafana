import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { FieldType, toDataFrame } from '@grafana/data';

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

const fields = toDataFrame({
  fields: [
    { name: 'Column A', type: FieldType.string, values: ['a'] },
    { name: 'Column B', type: FieldType.string, values: ['b'] },
  ],
}).fields;

// Mirrors how TableFlat owns this state: the panel itself holds none of it.
function Harness({
  initialHidden = new Set<string>(),
  initialPinned = new Set<string>(),
  onColumnsReorder = jest.fn(),
}: {
  initialHidden?: Set<string>;
  initialPinned?: Set<string>;
  onColumnsReorder?: (source: string, target: string) => void;
}) {
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(initialHidden);
  const [pinnedColumns, setPinnedColumns] = useState<ReadonlySet<string>>(initialPinned);

  return (
    <ColumnVisibilitySidePanel
      fields={fields}
      hiddenColumns={hiddenColumns}
      pinnedColumns={pinnedColumns}
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
      onTogglePin={(displayName) => {
        setPinnedColumns((current) => {
          const next = new Set(current);
          next.has(displayName) ? next.delete(displayName) : next.add(displayName);
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

  it('toggles column visibility', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByLabelText('Hide Column A'));
    expect(await screen.findByLabelText('Show Column A')).toBeInTheDocument();
  });

  it('toggles column pinning from the side panel', async () => {
    render(<Harness />);

    const pinButton = screen.getByLabelText('Pin Column A');
    expect(pinButton).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(pinButton);

    expect(await screen.findByLabelText('Unpin Column A')).toHaveAttribute('aria-pressed', 'true');
  });

  it('reorders columns by dragging the handle onto another item', () => {
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

  it('does not reorder a column across the pinned boundary', () => {
    const onColumnsReorder = jest.fn();
    render(<Harness initialPinned={new Set(['Column A'])} onColumnsReorder={onColumnsReorder} />);

    const handleB = screen.getByLabelText('Reorder Column B');
    const rowA = screen.getByLabelText('Reorder Column A').closest('div')!;
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(handleB, { dataTransfer });
    fireEvent.dragOver(rowA, { dataTransfer });
    fireEvent.drop(rowA, { dataTransfer });

    expect(onColumnsReorder).not.toHaveBeenCalled();
  });

  it('dims its contents while the splitter is dragged narrow enough to close it', () => {
    const props = {
      fields,
      hiddenColumns: new Set<string>(),
      pinnedColumns: new Set<string>(),
      onToggleColumn: jest.fn(),
      onTogglePin: jest.fn(),
      onColumnsReorder: jest.fn(),
      onClose: jest.fn(),
    };

    const { rerender } = render(<ColumnVisibilitySidePanel {...props} />);
    const panel = screen.getByRole('complementary', { name: 'Column visibility' });
    const contents = panel.firstElementChild!;
    expect(window.getComputedStyle(contents).opacity).toBe('');

    rerender(<ColumnVisibilitySidePanel {...props} willCloseOnRelease />);
    expect(window.getComputedStyle(contents).opacity).toBe('0.5');
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    render(
      <ColumnVisibilitySidePanel
        fields={fields}
        hiddenColumns={new Set()}
        pinnedColumns={new Set()}
        onToggleColumn={jest.fn()}
        onTogglePin={jest.fn()}
        onColumnsReorder={jest.fn()}
        onClose={onClose}
      />
    );

    await userEvent.click(screen.getByLabelText('Close column visibility panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
