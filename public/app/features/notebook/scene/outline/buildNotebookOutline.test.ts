import { VizPanel } from '@grafana/scenes';

import { NotebookCellItem } from '../layout-notebook/NotebookCellItem';

import { buildNotebookOutline, nestNotebookOutline, type NotebookOutlineNode } from './buildNotebookOutline';

function markdown(key: string, text: string) {
  return new NotebookCellItem({ key, elementName: key, source: 'user', content: { kind: 'Markdown', spec: { text } } });
}

function panel(key: string, title: string) {
  return new NotebookCellItem({
    key,
    elementName: key,
    source: 'user',
    body: new VizPanel({ title, pluginId: 'timeseries' }),
  });
}

function summarize(cells: NotebookCellItem[]) {
  return buildNotebookOutline(cells).map(({ cellKey, kind, label, depth }) => ({ cellKey, kind, label, depth }));
}

describe('buildNotebookOutline', () => {
  it('measures heading depth from the shallowest heading present', () => {
    expect(
      summarize([markdown('a', '## Overview'), markdown('b', '### Latency'), markdown('c', '## Findings')])
    ).toEqual([
      { cellKey: 'a', kind: 'heading', label: 'Overview', depth: 0 },
      { cellKey: 'b', kind: 'heading', label: 'Latency', depth: 1 },
      { cellKey: 'c', kind: 'heading', label: 'Findings', depth: 0 },
    ]);
  });

  it('lists every heading in a cell, all pointing at that cell, and ignores headings inside fenced code', () => {
    const text = ['# Summary', 'Some prose', '```', '# not a heading', '```', '## Next steps ##'].join('\n');

    expect(summarize([markdown('a', text)])).toEqual([
      { cellKey: 'a', kind: 'heading', label: 'Summary', depth: 0 },
      { cellKey: 'a', kind: 'heading', label: 'Next steps', depth: 1 },
    ]);
  });

  it('strips inline markdown from heading labels', () => {
    expect(summarize([markdown('a', '# **Errors** in `checkout` [service](http://x) _today_')])[0].label).toBe(
      'Errors in checkout service today'
    );
  });

  it('finds setext headings and headings inside quotes and lists, as the markdown renderer does', () => {
    const text = [
      'Overview',
      '========',
      '',
      '> ## Quoted',
      '',
      '- item',
      '',
      '  ### In a list',
      '',
      'Details',
      '---',
    ].join('\n');

    expect(summarize([markdown('a', text)])).toEqual([
      { cellKey: 'a', kind: 'heading', label: 'Overview', depth: 0 },
      { cellKey: 'a', kind: 'heading', label: 'Quoted', depth: 1 },
      { cellKey: 'a', kind: 'heading', label: 'In a list', depth: 2 },
      { cellKey: 'a', kind: 'heading', label: 'Details', depth: 1 },
    ]);
  });

  it('records where each heading sits in its cell, counting repeated labels', () => {
    const text = ['# Findings', '', 'Prose.', '', '## Notes', '', '> ## Notes', '', 'Title', '-----'].join('\n');

    expect(buildNotebookOutline([markdown('a', text)]).map(({ label, heading }) => ({ label, heading }))).toEqual([
      { label: 'Findings', heading: { line: 0, occurrence: 0 } },
      { label: 'Notes', heading: { line: 4, occurrence: 0 } },
      { label: 'Notes', heading: { line: 6, occurrence: 1 } },
      { label: 'Title', heading: { line: 8, occurrence: 0 } },
    ]);
  });

  // Ids key the outline's expanded state; a global index would shift every later id on each edit.
  it('keeps the ids of a cell entries unchanged when another cell gains a heading or a panel', () => {
    const later = [markdown('b', '# Errors\n\n## Timeouts'), panel('p', 'Error rate')];
    const before = buildNotebookOutline([markdown('a', '# Overview'), ...later]).slice(1);
    const after = buildNotebookOutline([
      markdown('a', '# Overview\n\n## Scope'),
      panel('new', 'Request rate'),
      ...later,
    ]).slice(3);

    expect(after.map((entry) => entry.id)).toEqual(['b:heading-0', 'b:heading-1', 'p:panel']);
    expect(after.map((entry) => entry.id)).toEqual(before.map((entry) => entry.id));
  });

  it('nests a panel one step under the heading before it, and at the top before any heading', () => {
    expect(summarize([panel('p1', 'Request rate'), markdown('h', '## Errors'), panel('p2', 'Error rate')])).toEqual([
      { cellKey: 'p1', kind: 'panel', label: 'Request rate', depth: 0 },
      { cellKey: 'h', kind: 'heading', label: 'Errors', depth: 0 },
      { cellKey: 'p2', kind: 'panel', label: 'Error rate', depth: 1 },
    ]);
  });

  it('labels a panel without a title as untitled', () => {
    expect(summarize([panel('p', '  ')])[0].label).toBe('Untitled panel');
  });

  it('leaves out code cells, collapsed cells and markdown without headings', () => {
    const cells = [
      new NotebookCellItem({
        key: 'code',
        elementName: 'code',
        source: 'user',
        content: { kind: 'Code', spec: { language: 'sql', code: '# comment' } },
      }),
      new NotebookCellItem({ key: 'collapsed', elementName: 'collapsed', source: 'user', collapsed: true }),
      markdown('prose', 'Just a paragraph'),
      markdown('h', '# Kept'),
    ];

    expect(summarize(cells)).toEqual([{ cellKey: 'h', kind: 'heading', label: 'Kept', depth: 0 }]);
  });
});

describe('nestNotebookOutline', () => {
  function labels(nodes: NotebookOutlineNode[]): unknown[] {
    return nodes.map((node) => (node.children.length ? [node.entry.label, labels(node.children)] : node.entry.label));
  }

  it('nests entries under the closest shallower heading before them', () => {
    const entries = buildNotebookOutline([
      panel('p0', 'Request rate'),
      markdown('a', '# Errors'),
      panel('p1', 'Error rate'),
      markdown('b', '### By endpoint'),
      panel('p2', 'Top endpoints'),
      markdown('c', '# Findings'),
    ]);

    expect(labels(nestNotebookOutline(entries))).toEqual([
      'Request rate',
      ['Errors', ['Error rate', ['By endpoint', ['Top endpoints']]]],
      'Findings',
    ]);
  });
});
