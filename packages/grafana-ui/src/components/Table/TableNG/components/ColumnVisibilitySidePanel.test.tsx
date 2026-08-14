import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { FieldType, toDataFrame } from '@grafana/data';

import { ColumnVisibilitySidePanel } from './ColumnVisibilitySidePanel';

const fields = toDataFrame({
  fields: [
    { name: 'Column A', type: FieldType.string, values: ['A'] },
    { name: 'Column B', type: FieldType.number, values: [1] },
  ],
}).fields;

function Harness() {
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(() => new Set());
  const [pinnedColumns, setPinnedColumns] = useState<ReadonlySet<string>>(() => new Set());

  return (
    <ColumnVisibilitySidePanel
      fields={fields}
      hiddenColumns={hiddenColumns}
      pinnedColumns={pinnedColumns}
      isOpen
      onToggleColumn={(displayName, visible) =>
        setHiddenColumns((current) => {
          const next = new Set(current);
          visible ? next.delete(displayName) : next.add(displayName);
          return next;
        })
      }
      onTogglePin={(displayName) =>
        setPinnedColumns((current) => {
          const next = new Set(current);
          next.has(displayName) ? next.delete(displayName) : next.add(displayName);
          return next;
        })
      }
      onColumnsReorder={jest.fn()}
    />
  );
}

describe('ColumnVisibilitySidePanel', () => {
  it('prevents hiding the last visible column', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: 'Hide Column A' }));

    expect(screen.getByRole('checkbox', { name: 'Show Column A' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Hide Column B' })).toBeDisabled();
  });

  it('toggles column pinning from the side panel', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const pinButton = screen.getByRole('button', { name: 'Pin Column A' });
    expect(pinButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(pinButton);

    expect(screen.getByRole('button', { name: 'Unpin Column A' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reorders columns by dragging the handle onto another item', () => {
    const onColumnsReorder = jest.fn();
    render(
      <ColumnVisibilitySidePanel
        fields={fields}
        hiddenColumns={new Set()}
        pinnedColumns={new Set()}
        isOpen
        onToggleColumn={jest.fn()}
        onTogglePin={jest.fn()}
        onColumnsReorder={onColumnsReorder}
      />
    );

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Reorder Column B' }), { dataTransfer });
    const targetRow = screen.getByRole('button', { name: 'Reorder Column A' }).parentElement!;
    fireEvent.dragOver(targetRow, { dataTransfer });
    fireEvent.drop(targetRow, { dataTransfer });

    expect(onColumnsReorder).toHaveBeenCalledWith('Column B', 'Column A');
  });

  it('does not reorder a column across the pinned boundary', () => {
    const onColumnsReorder = jest.fn();
    render(
      <ColumnVisibilitySidePanel
        fields={fields}
        hiddenColumns={new Set()}
        pinnedColumns={new Set(['Column A'])}
        isOpen
        onToggleColumn={jest.fn()}
        onTogglePin={jest.fn()}
        onColumnsReorder={onColumnsReorder}
      />
    );

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Reorder Column B' }), { dataTransfer });
    const targetRow = screen.getByRole('button', { name: 'Reorder Column A' }).parentElement!;
    fireEvent.dragOver(targetRow, { dataTransfer });
    fireEvent.drop(targetRow, { dataTransfer });

    expect(onColumnsReorder).not.toHaveBeenCalled();
  });

  it('animates list items when the field order changes externally', () => {
    const originalAnimate = HTMLElement.prototype.animate;
    const animate = jest.fn();
    HTMLElement.prototype.animate = animate;
    const rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const index = this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0;
      return { top: index * 32 } as DOMRect;
    });
    const commonProps = {
      hiddenColumns: new Set<string>(),
      pinnedColumns: new Set<string>(),
      isOpen: true,
      onToggleColumn: jest.fn(),
      onTogglePin: jest.fn(),
      onColumnsReorder: jest.fn(),
    };

    const { rerender } = render(<ColumnVisibilitySidePanel {...commonProps} fields={fields} />);
    rerender(<ColumnVisibilitySidePanel {...commonProps} fields={[...fields].reverse()} />);

    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translateY(32px)' }, { transform: 'translateY(0)' }],
      expect.objectContaining({ duration: 220 })
    );

    rectSpy.mockRestore();
    HTMLElement.prototype.animate = originalAnimate;
  });
});

function createDataTransfer() {
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: jest.fn(),
  };
}
