import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type NotebookLayoutKind } from 'app/features/notebook/types';

// Monaco does not run in jsdom; a textarea carries readOnly into the DOM so the edit-mode
// propagation is observable end to end.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value, readOnly }: { value: string; readOnly?: boolean }) => (
    <textarea aria-label="Code" defaultValue={value} readOnly={readOnly} />
  ),
}));

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';

function renderNotebook() {
  const cells = [
    new NotebookCellItem({
      elementName: 'md1',
      source: 'assistant',
      content: { kind: 'Markdown', spec: { text: 'Hello notebook' } },
    }),
    new NotebookCellItem({ elementName: 'hidden-panel', source: 'user', collapsed: true }),
  ];

  // The renderer reads the time range via sceneGraph.getTimeRange, which resolves the nearest
  // $timeRange up the graph — attaching it to the manager keeps the test root-agnostic.
  const manager = new NotebookLayoutManager({
    cells,
    title: 'My notebook',
    tags: ['incident', 'checkout'],
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
  });

  render(<manager.Component model={manager} />);
}

describe('NotebookLayoutManager', () => {
  it('renders the document header with badge, title, time range and tags', async () => {
    renderNotebook();

    expect(screen.getByText('Published Notebook')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My notebook' })).toBeInTheDocument();
    expect(screen.getByText(/now-6h/)).toBeInTheDocument();
    expect(screen.getByText('incident')).toBeInTheDocument();
    expect(screen.getByText('checkout')).toBeInTheDocument();
  });

  it('renders a narrative markdown cell and shows a collapsed cell by name only', async () => {
    renderNotebook();

    // Markdown content is rendered as sanitized HTML after mount.
    expect(await screen.findByText('Hello notebook')).toBeInTheDocument();
    // The collapsed cell renders only its element name, not its content.
    expect(screen.getByText('hidden-panel')).toBeInTheDocument();
  });

  describe('editModeChanged', () => {
    // The scene owns the mode; this is the channel it uses to hand the flag down, so the cells can
    // react without the manager reaching back up to the scene.
    it('records the mode so the cells can read it', () => {
      const manager = new NotebookLayoutManager({ cells: [] });

      expect(manager.state.isEditing).toBeUndefined();

      manager.editModeChanged(true);
      expect(manager.state.isEditing).toBe(true);

      manager.editModeChanged(false);
      expect(manager.state.isEditing).toBe(false);
    });

    it('reaches a code cell, which stops being read only', async () => {
      const manager = new NotebookLayoutManager({
        cells: [
          new NotebookCellItem({
            elementName: 'query',
            source: 'user',
            content: { kind: 'Code', spec: { code: 'select 1', language: 'sql' } },
          }),
        ],
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      });

      render(<manager.Component model={manager} />);

      const editor = await screen.findByLabelText('Code');
      expect(editor).toHaveAttribute('readonly');

      // act: the renderer subscribes to the manager, so this re-renders the cell.
      act(() => manager.editModeChanged(true));

      expect(screen.getByLabelText('Code')).not.toHaveAttribute('readonly');
    });
  });

  it('serializes to the notebook layout kind, not a dashboard layout kind', () => {
    const manager = new NotebookLayoutManager({
      cells: [new NotebookCellItem({ elementName: 'md1', source: 'assistant' })],
    });

    // The annotation carries the real check: serialize() is typed as the notebook's own kind, so
    // widening it back to the dashboard layout union fails `yarn typecheck`. It does not fail this
    // test run, since jest strips the types.
    const result: NotebookLayoutKind = manager.serialize();

    expect(result.kind).toBe('NotebookLayout');
  });

  describe('duplicate', () => {
    function buildManager() {
      return new NotebookLayoutManager({
        cells: [
          new NotebookCellItem({
            elementName: 'md1',
            source: 'assistant',
            content: { kind: 'Markdown', spec: { text: 'Hello' } },
          }),
          new NotebookCellItem({
            elementName: 'latency',
            source: 'user',
            body: new VizPanel({ key: 'panel-1', pluginId: 'timeseries' }),
          }),
          new NotebookCellItem({
            elementName: 'errors',
            source: 'user',
            body: new VizPanel({ key: 'panel-2', pluginId: 'timeseries' }),
          }),
        ],
      });
    }

    it('rekeys the cloned panels from the generator', () => {
      let next = 41;

      const clone = buildManager().duplicate(() => next++);

      expect(clone.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-41', 'panel-42']);
    });

    // Without a generator the manager seeds one off its own max id, so a duplicate never reuses the
    // originals' keys.
    it('rekeys past the existing ids when no generator is given', () => {
      const manager = buildManager();

      const clone = manager.duplicate();

      expect(clone.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-3', 'panel-4']);
      expect(manager.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-1', 'panel-2']);
    });

    it('clones narrative cells unchanged', () => {
      const clone = buildManager().duplicate();

      expect(clone.state.cells).toHaveLength(3);
      expect(clone.state.cells[0].state.body).toBeUndefined();
      expect(clone.state.cells[0].state.content).toEqual({ kind: 'Markdown', spec: { text: 'Hello' } });
    });
  });
});
