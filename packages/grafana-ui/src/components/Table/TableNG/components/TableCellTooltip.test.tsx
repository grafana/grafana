/* eslint-disable testing-library/prefer-user-event */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type RefObject } from 'react';

import { createTheme, type DataFrame, type Field, FieldType, toDataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type DataGridHandle } from '@grafana/react-data-grid';
import { TableCellDisplayMode } from '@grafana/schema';

import { JsonCell } from '../Cells/JsonCell';
import { getTooltipStyles } from '../styles';
import { type TableCellRenderer } from '../types';

import { TableCellTooltip, type TableCellTooltipProps } from './TableCellTooltip';

const theme = createTheme();

// Minimal renderer that renders the value as text so we can assert on it.
const TestRenderer: TableCellRenderer = ({ value }) => <div data-testid="tooltip-content">{String(value)}</div>;

function makeField(values: unknown[] = ['hello']): Field {
  return { name: 'Status', type: FieldType.string, values, config: {} };
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
  it('shows warnings before field content with one warning-colored indicator', async () => {
    renderInRdgCell({
      classes: getTooltipStyles(theme, 'left'),
      warnings: [
        { id: 'size', message: 'Content is too long.' },
        { id: 'other', message: 'Another warning.' },
      ],
    });
    const trigger = screen.getByRole('button', { name: 'Cell warnings' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(trigger).toHaveStyle({
      background: `linear-gradient(to top left, transparent 62.5%, ${theme.colors.warning.main} 50%)`,
    });
    await userEvent.hover(trigger);
    const tooltip = screen.getByRole('tooltip');
    expect(
      within(tooltip)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Content is too long.', 'Another warning.']);
    expect(within(tooltip).getByRole('separator')).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/^Content is too long.Another warning.hello$/);
    await userEvent.click(trigger);
    await userEvent.click(within(tooltip).getByText('hello'));
    expect(trigger).toHaveAttribute('aria-pressed', 'true');
    expect(tooltip).toBeInTheDocument();
  });

  it.each([null, undefined, ''])('keeps warnings without an empty field section for %s', async (value) => {
    renderInRdgCell({ field: makeField([value]), warnings: [{ id: 'size', message: 'Content is too long.' }] });
    await userEvent.click(screen.getByRole('button', { name: 'Cell warnings' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Content is too long.');
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
  });

  it('pins and dismisses warning-only content with Escape while focused', async () => {
    const user = userEvent.setup();
    renderInRdgCell({ showFieldContent: false, warnings: [{ id: 'size', message: 'Content is too long.' }] });
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Cell warnings' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Content is too long.');
    expect(trigger).toHaveAccessibleDescription('Content is too long.');
    expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the gray indicator for field-only content', async () => {
    renderInRdgCell({ classes: getTooltipStyles(theme, 'left') });
    const trigger = screen.getByRole('button', { name: CARET_LABEL });
    expect(trigger).toHaveStyle({
      background: `linear-gradient(to top left, transparent 62.5%, ${theme.colors.border.strong} 50%)`,
    });
    await userEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('hello');
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('keeps the preview open while moving from the indicator to its content', async () => {
    const user = userEvent.setup();
    renderInRdgCell({ warnings: [{ id: 'size', message: 'Content is too long.' }] });
    await user.hover(screen.getByRole('button', { name: 'Cell warnings' }));
    await user.hover(screen.getByRole('tooltip'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Content is too long.');
    await user.unhover(screen.getByRole('tooltip'));
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('closes a pinned popover when another cell indicator is clicked', async () => {
    const user = userEvent.setup();
    renderInRdgCell({ warnings: [{ id: 'first', message: 'First warning.' }] });
    renderInRdgCell();
    const first = screen.getByRole('button', { name: 'Cell warnings' });
    await user.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: CARET_LABEL }));
    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });

  it('passes JSON highlighting through to tooltip content', async () => {
    const field = makeField(['{"active":true}']);
    field.display = () => ({ text: '{"active":true}', numeric: NaN });
    renderInRdgCell({
      field,
      cellOptions: { type: TableCellDisplayMode.JSONView },
      renderer: JsonCell,
      jsonSyntaxHighlightingEnabled: true,
    });
    await userEvent.click(screen.getByRole('button', { name: CARET_LABEL }));
    expect(await screen.findByText('true')).toHaveStyle({ color: theme.components.codeEditor.number });
    expect(screen.getByTestId(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper)).toHaveTextContent(
      '{"active":true}'
    );
  });

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
      await waitFor(() => expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument());
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
      renderInRdgCell({
        field: makeField(['row-zero', 'row-one']),
        data: makeData(['row-zero', 'row-one']),
        rowIdx: 1,
      });
      await user.click(screen.getByRole('button', { name: CARET_LABEL }));
      expect(screen.getByText('row-one')).toBeInTheDocument();
    });

    // The tooltip is a free-floating overlay that should size to its content, so the
    // popover container must never be constrained to a fixed height (which would clip
    // content taller than the originating cell's row height).
    it('does not apply a fixed height to the popover wrapper', async () => {
      const user = userEvent.setup();
      renderInRdgCell({ height: 32 });
      await user.click(screen.getByRole('button', { name: CARET_LABEL }));
      const wrapper = screen.getByTestId(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper);
      expect(wrapper).not.toHaveStyle({ height: '32px' });
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
