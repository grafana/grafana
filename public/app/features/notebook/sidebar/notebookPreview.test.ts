import { defaultPanelKind, type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';

import { getNotebookOutlineItems } from './notebookPreview';

function notebook(): NotebookSpec {
  const panel = defaultPanelKind();

  return {
    ...defaultNotebookSpec(),
    title: 'Investigation',
    elements: {
      intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: '  First\n finding  ' } } } },
      blank: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: '   ' } } } },
      query: { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language: 'javascript', code: '\nrun();' } } } },
      panel: {
        ...panel,
        spec: { ...panel.spec, id: 1, title: 'Request rate' },
      },
      orphan: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Not in the layout' } } } },
    },
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: ['intro', 'blank', 'query', 'panel'].map((name) => ({
          kind: 'NotebookLayoutItem' as const,
          spec: { element: { kind: 'ElementReference' as const, name }, source: 'user' as const },
        })),
      },
    },
  };
}

describe('getNotebookPreviewItems', () => {
  it('returns every layout item in notebook order', () => {
    expect(getNotebookOutlineItems(notebook())).toEqual([
      { elementName: 'intro', kind: 'note', label: 'First finding' },
      { elementName: 'blank', kind: 'note', label: 'Empty note' },
      { elementName: 'query', kind: 'code', label: 'run();' },
      { elementName: 'panel', kind: 'visualization', label: 'Request rate' },
    ]);
  });

  it('ignores elements that are not referenced by the layout', () => {
    expect(getNotebookOutlineItems(notebook()).map((item) => item.elementName)).not.toContain('orphan');
  });
});
