/* eslint-disable testing-library/prefer-user-event */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type RefObject } from 'react';

import { createTheme, type DataFrame, type Field, FieldType, toDataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type DataGridHandle } from '@grafana/react-data-grid';
import { TableCellDisplayMode } from '@grafana/schema';

import { DataLinksCell } from '../Cells/DataLinksCell';
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
  it.each(['{Enter}', ' '])('opens a field dialog with %s and reaches a data link by keyboard', async (key) => {
    const user = userEvent.setup();
    const onClick = jest.fn((event) => event.preventDefault());
    const field = makeField();
    field.getLinks = () => [{ title: 'Open details', href: '/details', target: '_self', origin: field, onClick }];
    renderInRdgCell({ field, renderer: DataLinksCell });
    await user.tab();
    const trigger = screen.getByRole('button', { name: CARET_LABEL });
    const dialog = screen.getByRole('dialog', { name: 'Cell preview' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    expect(trigger).not.toHaveAttribute('aria-describedby');
    expect(dialog).not.toHaveAttribute('aria-modal');

    await user.keyboard(key);
    expect(dialog).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Open details' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(dialog).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
  });

  it('keeps focus outside on hover, accepts padding clicks, and preserves outside-click focus', async () => {
    const user = userEvent.setup();
    renderInRdgCell();
    render(<button>Outside</button>);
    const outside = screen.getByRole('button', { name: 'Outside' });
    const trigger = screen.getByRole('button', { name: CARET_LABEL });
    await user.click(outside);
    await user.hover(trigger);
    expect(screen.getByRole('dialog', { name: 'Cell preview' })).toHaveTextContent('hello');
    expect(outside).toHaveFocus();
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Cell preview' });
    await user.click(dialog);
    expect(dialog).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-pressed', 'true');
    await user.click(outside);
    expect(outside).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Cell preview' })).not.toBeInTheDocument();
  });

  it.each(['padding', 'content'])(
    'dismisses an unpinned preview after a %s click when an outside click preserves focus',
    async (target) => {
      const user = userEvent.setup();
      renderInRdgCell();
      render(<button onMouseDown={(event) => event.preventDefault()}>Outside</button>);
      const trigger = screen.getByRole('button', { name: CARET_LABEL });

      await user.hover(trigger);
      const dialog = screen.getByRole('dialog', { name: 'Cell preview' });
      await user.click(target === 'padding' ? dialog : within(dialog).getByText('hello'));
      expect(dialog).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-pressed', 'false');

      await user.click(screen.getByRole('button', { name: 'Outside' }));
      expect(screen.queryByRole('dialog', { name: 'Cell preview' })).not.toBeInTheDocument();

      await user.hover(trigger);
      expect(screen.getByRole('dialog', { name: 'Cell preview' })).toHaveTextContent('hello');
      await user.unhover(trigger);
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cell preview' })).not.toBeInTheDocument());
    }
  );

  it.each(['hover', 'focus'])(
    'preserves an unpinned %s preview when the source cell receives a click',
    async (mode) => {
      const user = userEvent.setup();
      renderInRdgCell();
      const trigger = screen.getByRole('button', { name: CARET_LABEL });
      if (mode === 'hover') {
        await user.hover(trigger);
      } else {
        await user.tab();
        expect(trigger).toHaveFocus();
      }
      expect(screen.getByRole('dialog', { name: 'Cell preview' })).toHaveTextContent('hello');

      // Isolate the click from pointer movement and blur, which have their own dismissal behavior.
      fireEvent.click(screen.getByText('cell content'));
      expect(screen.getByRole('dialog', { name: 'Cell preview' })).toHaveTextContent('hello');
      expect(trigger).toHaveAttribute('aria-pressed', 'false');

      if (mode === 'hover') {
        await user.unhover(trigger);
      } else {
        await user.tab();
      }
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cell preview' })).not.toBeInTheDocument());
    }
  );

  it('allows Tab to leave a pinned field preview', async () => {
    const user = userEvent.setup();
    renderInRdgCell();
    const trigger = screen.getByRole('button', { name: CARET_LABEL });
    await user.click(trigger);
    render(<button>After preview</button>);
    expect(screen.getByRole('dialog', { name: 'Cell preview' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After preview' })).toHaveFocus();
  });

  it.each([false, true])('keeps field color on the correct surface (warnings: %s)', async (hasWarnings) => {
    renderInRdgCell({
      classes: getTooltipStyles(theme, 'left'),
      style: { background: 'rgb(10, 20, 30)', color: 'rgb(240, 240, 240)' },
      warnings: hasWarnings ? [{ id: 'size', message: 'Content is too long.' }] : [],
    });
    await userEvent.click(screen.getByRole('button', { name: hasWarnings ? 'Cell warnings' : CARET_LABEL }));
    const dialog = screen.getByRole('dialog', { name: 'Cell preview' });
    const fieldSurface = screen.getByTestId('tooltip-content').parentElement;
    expect(hasWarnings ? fieldSurface : dialog).toHaveStyle({
      background: 'rgb(10, 20, 30)',
      color: 'rgb(240, 240, 240)',
    });
    if (hasWarnings) {
      expect(dialog).toHaveStyle({ background: theme.colors.background.primary });
      expect(screen.getByText('Content is too long.').parentElement).toHaveStyle({
        color: theme.colors.text.primary,
      });
    }
  });

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
    const tooltip = screen.getByRole('dialog', { name: 'Cell preview' });
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
    expect(trigger).not.toHaveAttribute('aria-haspopup');
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
    expect(screen.getByRole('dialog', { name: 'Cell preview' })).toHaveTextContent('hello');
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it.each(['hovered', 'pinned'])(
    'lets Escape reach the parent when the %s tooltip has focus elsewhere',
    async (mode) => {
      const user = userEvent.setup();
      const onEscape = jest.fn();
      render(
        <div role="dialog" tabIndex={-1} onKeyDown={(event) => event.key === 'Escape' && onEscape()}>
          <div className="rdg-cell">
            <TableCellTooltip {...makeProps()}>
              <span>cell content</span>
            </TableCellTooltip>
          </div>
          <button>Other control</button>
        </div>
      );
      const trigger = screen.getByRole('button', { name: CARET_LABEL });
      if (mode === 'pinned') {
        await user.click(trigger);
        await user.tab({ shift: true });
        await user.tab();
        expect(trigger).toHaveAttribute('aria-pressed', 'true');
      } else {
        await user.click(screen.getByRole('button', { name: 'Other control' }));
        await user.hover(trigger);
      }
      expect(screen.getByRole('button', { name: 'Other control' })).toHaveFocus();
      expect(screen.getByRole('dialog', { name: 'Cell preview' })).toHaveTextContent('hello');

      await user.keyboard('{Escape}');

      expect(onEscape).toHaveBeenCalledTimes(1);
      expect(trigger).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('dialog', { name: 'Cell preview' })).not.toBeInTheDocument();
    }
  );

  it.each(['trigger', 'content'])('consumes Escape when focus is on the tooltip %s', async (target) => {
    const user = userEvent.setup();
    const onEscape = jest.fn();
    const onAction = jest.fn();
    const FocusableRenderer: TableCellRenderer = () => <button onClick={onAction}>Tooltip action</button>;
    render(
      <div role="dialog" tabIndex={-1} onKeyDown={(event) => event.key === 'Escape' && onEscape()}>
        <div className="rdg-cell">
          <TableCellTooltip {...makeProps({ renderer: FocusableRenderer })}>
            <span>cell content</span>
          </TableCellTooltip>
        </div>
      </div>
    );
    const trigger = screen.getByRole('button', { name: CARET_LABEL });
    await user.click(trigger);
    const focusTarget = target === 'trigger' ? trigger : screen.getByRole('button', { name: 'Tooltip action' });
    if (target === 'content') {
      await user.tab();
    } else {
      await user.tab({ shift: true });
    }
    expect(focusTarget).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Cell preview' })).toHaveTextContent('Tooltip action');
    if (target === 'content') {
      await user.keyboard('{Enter}');
      expect(onAction).toHaveBeenCalledTimes(1);
    }

    await user.keyboard('{Escape}');

    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('dialog', { name: 'Cell preview' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('keeps the preview open while moving from the indicator to its content', async () => {
    const user = userEvent.setup();
    renderInRdgCell({ warnings: [{ id: 'size', message: 'Content is too long.' }] });
    await user.hover(screen.getByRole('button', { name: 'Cell warnings' }));
    await user.hover(screen.getByRole('dialog', { name: 'Cell preview' }));
    expect(screen.getByRole('dialog', { name: 'Cell preview' })).toHaveTextContent('Content is too long.');
    await user.unhover(screen.getByRole('dialog', { name: 'Cell preview' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cell preview' })).not.toBeInTheDocument());
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
    expect(screen.getAllByRole('dialog', { name: 'Cell preview' })).toHaveLength(1);
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
