import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { SceneTimeRange } from '@grafana/scenes';
import { type NotebookLayoutKind } from '@grafana/schema/apis/notebook/v2beta1';

import { DashboardScene } from '../DashboardScene';

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

  const manager = new NotebookLayoutManager({ cells, title: 'My notebook', tags: ['incident', 'checkout'] });

  // The renderer reads the time range from the scene graph, so the manager must be parented to a
  // scene that provides one.
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: manager,
  });
  scene.activate();

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

  // Still the notebook's own source of narrative elements, even though the notebook now has its own
  // transformer: `transformSceneToNotebookSaveModel` asks the layout for these (through
  // `getNotebookCellElements`) rather than deriving them, because `getVizPanels()` cannot report a
  // markdown or code cell and only the manager knows what it holds. Where it moved to is the
  // dashboard serializer no longer needing to know that some layouts own elements it cannot see.
  describe('getNonPanelElements', () => {
    it('reports markdown and code cells keyed by element name', () => {
      const manager = new NotebookLayoutManager({
        cells: [
          new NotebookCellItem({
            elementName: 'intro',
            source: 'assistant',
            content: { kind: 'Markdown', spec: { text: '## Findings' } },
          }),
          new NotebookCellItem({
            elementName: 'repro',
            source: 'user',
            content: { kind: 'Code', spec: { language: 'promql', code: 'up' } },
          }),
        ],
      });

      expect(manager.getNonPanelElements()).toEqual({
        intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: '## Findings' } } } },
        repro: { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language: 'promql', code: 'up' } } } },
      });
    });

    it('skips panel cells, which the transformer already gets from getVizPanels', () => {
      const manager = new NotebookLayoutManager({
        cells: [new NotebookCellItem({ elementName: 'panel-1', source: 'assistant' })],
      });

      expect(manager.getNonPanelElements()).toEqual({});
    });

    it('returns an empty map for an empty notebook', () => {
      expect(new NotebookLayoutManager({ cells: [] }).getNonPanelElements()).toEqual({});
    });
  });
});
