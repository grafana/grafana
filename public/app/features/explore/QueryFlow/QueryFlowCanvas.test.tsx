import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QueryFlowCanvas } from './QueryFlowCanvas';
import { layoutGraph } from './layout';
import { promqlMapper } from './model/languages/promql';

const EXPR = 'sum by (le) (rate(metric{job="api"}[5m]))';

// jsdom doesn't implement `PointerEvent` (only plain `Event`), so RTL's `fireEvent.pointerDown` et
// al. silently drop pointer-specific fields like `clientX`/`button`. Build the event manually and
// assign the fields our handlers read so drag/pan interactions are exercisable in tests.
function pointerEvent(type: string, init: { clientX: number; clientY: number; button?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: init.clientX, clientY: init.clientY, button: init.button ?? 0 });
  return event;
}

describe('QueryFlowCanvas', () => {
  const layout = layoutGraph(promqlMapper.buildGraph(EXPR));

  it('renders the graph nodes', () => {
    render(<QueryFlowCanvas layout={layout} />);
    expect(screen.getByTestId('query-flow-graph')).toBeInTheDocument();
    expect(screen.getAllByTestId('query-flow-node').length).toBeGreaterThan(1);
  });

  it('exposes zoom and reset controls', () => {
    render(<QueryFlowCanvas layout={layout} />);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeInTheDocument();
  });

  it('keeps a manually dragged node at its dragged position across a layout rebuild with unchanged ids', () => {
    const layoutA = layoutGraph(promqlMapper.buildGraph(EXPR));
    const { rerender } = render(<QueryFlowCanvas layout={layoutA} />);

    const nodeEl = screen.getAllByTestId('query-flow-node')[0];
    const originalLeft = nodeEl.style.left;

    fireEvent(nodeEl, pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    fireEvent(window, pointerEvent('pointermove', { clientX: 160, clientY: 140 }));
    fireEvent(window, pointerEvent('pointerup', { clientX: 160, clientY: 140 }));

    const draggedLeft = nodeEl.style.left;
    expect(draggedLeft).not.toBe(originalLeft);

    // A live-typing rebuild that reproduces the exact same graph shape/ids — the previous bug reset
    // every node back to its auto-layout position on every keystroke, making drag unusable.
    const layoutB = layoutGraph(promqlMapper.buildGraph(EXPR));
    rerender(<QueryFlowCanvas layout={layoutB} />);

    expect(nodeEl.style.left).toBe(draggedLeft);
  });

  it('resets a dragged node back to auto-layout once it no longer exists in a new graph', () => {
    const layoutA = layoutGraph(promqlMapper.buildGraph(EXPR));
    const { rerender } = render(<QueryFlowCanvas layout={layoutA} />);

    const nodeEl = screen.getAllByTestId('query-flow-node')[0];
    fireEvent(nodeEl, pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    fireEvent(window, pointerEvent('pointermove', { clientX: 160, clientY: 140 }));
    fireEvent(window, pointerEvent('pointerup', { clientX: 160, clientY: 140 }));

    // A structurally different query produces different node ids — none of the old positions apply.
    const layoutC = layoutGraph(promqlMapper.buildGraph('count(other_metric{env="prod"})'));
    rerender(<QueryFlowCanvas layout={layoutC} />);

    const newNodeEl = screen.getAllByTestId('query-flow-node')[0];
    const expected = `${layoutC.nodes[0].x}px`;
    expect(newNodeEl.style.left).toBe(expected);
  });

  it('adds a panning class while background-dragging and removes it after release', () => {
    render(<QueryFlowCanvas layout={layout} />);
    const viewport = screen.getByTestId('query-flow-graph');
    const idleClassName = viewport.className;

    fireEvent(viewport, pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
    expect(viewport.className).not.toBe(idleClassName);

    fireEvent(window, pointerEvent('pointerup', { clientX: 10, clientY: 10 }));
    expect(viewport.className).toBe(idleClassName);
  });

  it('makes node cards focusable and selects them with Enter/Space', async () => {
    const user = userEvent.setup();
    render(<QueryFlowCanvas layout={layout} />);

    const nodeEl = screen.getAllByTestId('query-flow-node')[0];
    expect(nodeEl).toHaveAttribute('aria-pressed', 'false');

    nodeEl.focus();
    expect(nodeEl).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(nodeEl).toHaveAttribute('aria-pressed', 'true');
  });

  it('requests enrichment and hover-highlights a node card on keyboard focus', () => {
    const onRequestEnrichment = jest.fn();
    const onNodeHover = jest.fn();
    render(<QueryFlowCanvas layout={layout} onRequestEnrichment={onRequestEnrichment} onNodeHover={onNodeHover} />);

    const nodeEl = screen.getAllByTestId('query-flow-node')[0];
    fireEvent.focus(nodeEl);
    expect(onRequestEnrichment).toHaveBeenCalled();
    expect(onNodeHover).toHaveBeenCalled();

    fireEvent.blur(nodeEl);
    expect(onNodeHover).toHaveBeenLastCalledWith(null);
  });

  it('pans with arrow keys and zooms with +/- when the viewport background has focus', () => {
    render(<QueryFlowCanvas layout={layout} />);
    const viewport = screen.getByTestId('query-flow-graph');
    const inner = viewport.firstElementChild as HTMLElement;

    viewport.focus();
    const originalTransform = inner.style.transform;

    fireEvent.keyDown(viewport, { key: 'ArrowRight' });
    expect(inner.style.transform).not.toBe(originalTransform);

    const pannedTransform = inner.style.transform;
    fireEvent.keyDown(viewport, { key: '+' });
    expect(inner.style.transform).not.toBe(pannedTransform);
  });
});
