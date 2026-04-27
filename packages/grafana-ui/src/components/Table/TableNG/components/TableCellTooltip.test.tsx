import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type RefObject } from 'react';
import { type DataGridHandle } from 'react-data-grid';

import { createTheme, type DataFrame, type Field, FieldType, toDataFrame } from '@grafana/data';

import { type TableCellRenderer } from '../types';

import { TableCellTooltip, TableCellTooltipProps } from './TableCellTooltip';
import { TableCellDisplayMode } from '@grafana/schema';

const theme = createTheme();

// Minimal renderer that renders the value as text so we can assert on it.
const TestRenderer: TableCellRenderer = ({ value }) => (
  <div data-testid="tooltip-content">{String(value)}</div>
);

function makeField(values: unknown[] = ['hello']): Field {
  return { name: 'Status', type: FieldType.string, values, config: {} };
}

function makeTooltipField(dynamicHeight = false): Field {
  return {
    name: 'Status',
    type: FieldType.string,
    values: ['hello'],
    config: { custom: { cellOptions: { dynamicHeight } } },
  };
}

function makeData(values: unknown[] = ['hello']): DataFrame {
  return toDataFrame({ fields: [{ name: 'Status', type: FieldType.string, values }] });
}

function makeGridRef(element?: HTMLElement): RefObject<DataGridHandle | null> {
  return { current: element ? ({ element } as unknown as DataGridHandle) : null };
}

const defaultClasses = { tooltipWrapper: '', tooltipCaret: '', tooltipContent: '' };

function makeProps(overrides: Partial<TableCellTooltipProps> = {}): Omit<TableCellTooltipProps, 'children'> {
  return {
    cellOptions: { type: TableCellDisplayMode.Auto },
    classes: defaultClasses,
    data: makeData(),
    field: makeField(),
    tooltipField: makeTooltipField(),
    getActions: () => [],
    getTextColorForBackground: () => '#000',
    gridRef: makeGridRef(),
    height: 32,
    rowIdx: 0,
    renderer: TestRenderer,
    theme,
    ...overrides,
  };
}

// Wrapping in .rdg-cell lets the caret's closest() call find a reference element,
// which enables the Popover to mount on subsequent renders.
function renderInRdgCell(overrides: Record<string, unknown> = {}) {
  return render(
    <div className="rdg-cell">
      <TableCellTooltip {...makeProps(overrides)}>
        <span>cell content</span>
      </TableCellTooltip>
    </div>
  );
}

const CARET_LABEL = 'Toggle tooltip';

describe('TableCellTooltip', () => {
  describe('null / undefined rawValue', () => {
    it('renders only children for a null value and omits the caret trigger', () => {
      render(
        <TableCellTooltip {...makeProps({ field: makeField([null]) })}>
          <span>cell content</span>
        </TableCellTooltip>
      );
      expect(screen.getByText('cell content')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: CARET_LABEL })).not.toBeInTheDocument();
    });

    it('renders only children for an undefined value and omits the caret trigger', () => {
      render(
        <TableCellTooltip {...makeProps({ field: makeField([undefined]) })}>
          <span>cell content</span>
        </TableCellTooltip>
      );
      expect(screen.getByText('cell content')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: CARET_LABEL })).not.toBeInTheDocument();
    });
  });

  describe('caret trigger', () => {
    it('renders the caret button for a non-null value', () => {
      render(
        <TableCellTooltip {...makeProps()}>
          <span>cell content</span>
        </TableCellTooltip>
      );
      expect(screen.getByRole('button', { name: CARET_LABEL })).toBeInTheDocument();
    });

    it('renders children alongside the caret', () => {
      render(
        <TableCellTooltip {...makeProps()}>
          <span>my cell text</span>
        </TableCellTooltip>
      );
      expect(screen.getByText('my cell text')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: CARET_LABEL })).toBeInTheDocument();
    });

    it('starts with aria-pressed false (unpinned)', () => {
      render(
        <TableCellTooltip {...makeProps()}>
          <span>c</span>
        </TableCellTooltip>
      );
      expect(screen.getByRole('button', { name: CARET_LABEL })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('pinning via click', () => {
    it('clicking the caret pins the tooltip (aria-pressed becomes true)', async () => {
      const user = userEvent.setup();
      render(
        <TableCellTooltip {...makeProps()}>
          <span>c</span>
        </TableCellTooltip>
      );
      await user.click(screen.getByRole('button', { name: CARET_LABEL }));
      expect(screen.getByRole('button', { name: CARET_LABEL })).toHaveAttribute('aria-pressed', 'true');
    });

    it('clicking the caret a second time unpins it', async () => {
      const user = userEvent.setup();
      render(
        <TableCellTooltip {...makeProps()}>
          <span>c</span>
        </TableCellTooltip>
      );
      const caret = screen.getByRole('button', { name: CARET_LABEL });
      await user.click(caret);
      await user.click(caret);
      expect(caret).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('pinning via keyboard', () => {
    it('pressing Enter on the caret pins the tooltip', () => {
      render(
        <TableCellTooltip {...makeProps()}>
          <span>c</span>
        </TableCellTooltip>
      );
      const caret = screen.getByRole('button', { name: CARET_LABEL });
      fireEvent.keyDown(caret, { key: 'Enter' });
      expect(caret).toHaveAttribute('aria-pressed', 'true');
    });

    it('pressing Space on the caret pins the tooltip', () => {
      render(
        <TableCellTooltip {...makeProps()}>
          <span>c</span>
        </TableCellTooltip>
      );
      const caret = screen.getByRole('button', { name: CARET_LABEL });
      fireEvent.keyDown(caret, { key: ' ' });
      expect(caret).toHaveAttribute('aria-pressed', 'true');
    });

    it('pressing Tab does not affect pinned state', () => {
      render(
        <TableCellTooltip {...makeProps()}>
          <span>c</span>
        </TableCellTooltip>
      );
      const caret = screen.getByRole('button', { name: CARET_LABEL });
      fireEvent.keyDown(caret, { key: 'Tab' });
      expect(caret).toHaveAttribute('aria-pressed', 'false');
    });

    it('pressing Enter while pinned unpins the tooltip', () => {
      render(
        <TableCellTooltip {...makeProps()}>
          <span>c</span>
        </TableCellTooltip>
      );
      const caret = screen.getByRole('button', { name: CARET_LABEL });
      fireEvent.keyDown(caret, { key: 'Enter' });
      fireEvent.keyDown(caret, { key: 'Enter' });
      expect(caret).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('hover and focus state', () => {
    it('hovering the caret shows the Popover content', async () => {
      const user = userEvent.setup();
      renderInRdgCell();
      await user.hover(screen.getByRole('button', { name: CARET_LABEL }));
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('unhovering the caret hides the Popover content', async () => {
      const user = userEvent.setup();
      renderInRdgCell();
      const caret = screen.getByRole('button', { name: CARET_LABEL });
      await user.hover(caret);
      await user.unhover(caret);
      expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
    });

    it('focusing the caret shows the Popover content', () => {
      renderInRdgCell();
      fireEvent.focus(screen.getByRole('button', { name: CARET_LABEL }));
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('blurring the caret hides the Popover content', () => {
      renderInRdgCell();
      const caret = screen.getByRole('button', { name: CARET_LABEL });
      fireEvent.focus(caret);
      fireEvent.blur(caret);
      expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
    });
  });

  describe('auto-unpinning', () => {
    it('clicking outside the caret while pinned unpins the tooltip', async () => {
      const user = userEvent.setup();
      render(
        <TableCellTooltip {...makeProps()}>
          <span>c</span>
        </TableCellTooltip>
      );
      const caret = screen.getByRole('button', { name: CARET_LABEL });
      await user.click(caret);
      expect(caret).toHaveAttribute('aria-pressed', 'true');
      await user.click(document.body);
      expect(caret).toHaveAttribute('aria-pressed', 'false');
    });

    it('scrolling the grid element while pinned unpins the tooltip', async () => {
      const user = userEvent.setup();
      const gridElement = document.createElement('div');
      document.body.appendChild(gridElement);

      render(
        <TableCellTooltip {...makeProps({ gridRef: makeGridRef(gridElement) })}>
          <span>c</span>
        </TableCellTooltip>
      );
      const caret = screen.getByRole('button', { name: CARET_LABEL });
      await user.click(caret);
      expect(caret).toHaveAttribute('aria-pressed', 'true');

      fireEvent.scroll(gridElement);
      expect(caret).toHaveAttribute('aria-pressed', 'false');

      gridElement.remove();
    });
  });

  describe('Popover renderer content', () => {
    it('renders the tooltip content via the renderer when pinned', async () => {
      const user = userEvent.setup();
      renderInRdgCell();
      await user.click(screen.getByRole('button', { name: CARET_LABEL }));
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('passes the field value at the given rowIdx to the renderer', async () => {
      const user = userEvent.setup();
      renderInRdgCell({ field: makeField(['row-zero', 'row-one']), data: makeData(['row-zero', 'row-one']), rowIdx: 1 });
      await user.click(screen.getByRole('button', { name: CARET_LABEL }));
      expect(screen.getByText('row-one')).toBeInTheDocument();
    });

    it('the Popover is not rendered when there is no .rdg-cell ancestor', async () => {
      // Without .rdg-cell, cellElement is null and the Popover never mounts,
      // even when show=true.
      const user = userEvent.setup();
      render(
        <TableCellTooltip {...makeProps()}>
          <span>c</span>
        </TableCellTooltip>
      );
      await user.click(screen.getByRole('button', { name: CARET_LABEL }));
      expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
    });
  });
});
